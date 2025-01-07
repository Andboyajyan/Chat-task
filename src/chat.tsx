import React, { useState } from "react";
import { ItemContent, Virtuoso } from "react-virtuoso";
import cn from "clsx";
import { useQuery, useMutation, useSubscription } from "@apollo/client";
import {
  GET_MESSAGES,
  SEND_MESSAGE,
  ON_NEW_MESSAGE,
} from "./graphql/queries/messages";
import {
  MessageEdge,
  MessageSender,
  Message,
  MessagePage,
  Subscription,
} from "../__generated__/resolvers-types";
import css from "./chat.module.css";

const Item: React.FC<Message> = ({ text, sender }) => {
  return (
    <div className={css.item}>
      <div
        className={cn(
          css.message,
          sender === MessageSender.Admin ? css.out : css.in
        )}
      >
        {text}
      </div>
    </div>
  );
};

const getItem: ItemContent<Message, unknown> = (_, message) => {
  return <Item {...message} />;
};

export const Chat: React.FC = () => {
  const [newMessage, setNewMessage] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);

  const { data, loading, error, fetchMore } = useQuery<{
    messages: MessagePage;
  }>(GET_MESSAGES, {
    variables: { first: 20, after: null },
    onCompleted: (fetchedData) => {
      const edges = fetchedData?.messages?.edges || [];
      setMessages(edges.map((edge: MessageEdge) => edge.node));
    },
  });

  const [sendMessage] = useMutation(SEND_MESSAGE);

  useSubscription<Subscription>(ON_NEW_MESSAGE, {
    onData: ({ data }) => {
      const message = data?.data?.messageAdded;
      if (!message) return;

      // Обновление сообщений, полученных через подписку
      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages, message];
        return updatedMessages.sort(
          (a, b) =>
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        );
      });
    },
  });

  if (loading) {
    return <p>Loading...</p>;
  }

  if (error) {
    return <p>Error: {error.message}</p>;
  }

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    try {
      await sendMessage({
        variables: { text: newMessage },
        update: (cache, { data }) => {
          const newMessage = data?.sendMessage;
          if (!newMessage) return;

          cache.modify({
            fields: {
              messages(existingMessages = []) {
                if (!Array.isArray(existingMessages)) {
                  console.error(
                    "existingMessages is not an array:",
                    existingMessages
                  );
                  return [];
                }

                const newMessageEdge = {
                  __typename: "MessageEdge",
                  node: newMessage,
                  cursor: newMessage.id,
                };

                const updatedMessages = [...existingMessages, newMessageEdge];

                return updatedMessages.sort(
                  (a, b) =>
                    new Date(a.node.updatedAt).getTime() -
                    new Date(b.node.updatedAt).getTime()
                );
              },
            },
          });
        },
      });
      setNewMessage("");
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleEndReached = () => {
    if (data?.messages?.pageInfo?.hasNextPage) {
      fetchMore({
        variables: { after: data.messages.pageInfo.endCursor },
        updateQuery: (prevResult, { fetchMoreResult }) => {
          const newEdges: MessageEdge[] = fetchMoreResult.messages.edges;
          const uniqueEdges = [
            ...prevResult.messages.edges,
            ...newEdges.filter(
              (newEdge) =>
                !prevResult.messages.edges.some(
                  (existingEdge) => existingEdge.node.id === newEdge.node.id
                )
            ),
          ];

          return {
            messages: {
              ...fetchMoreResult.messages,
              edges: uniqueEdges,
            },
          };
        },
      }).then((fetchMoreResult) => {
        setMessages((prevMessages) => {
          const newMessages: Message[] =
            fetchMoreResult.data.messages.edges.map(
              (edge: MessageEdge) => edge.node
            );
          const uniqueMessages = [
            ...prevMessages,
            ...newMessages.filter(
              (newMessage) =>
                !prevMessages.some(
                  (existingMessage) => existingMessage.id === newMessage.id
                )
            ),
          ];

          return uniqueMessages;
        });
      });
    }
  };

  return (
    <div className={css.root}>
      <div className={css.container}>
        <Virtuoso
          className={css.list}
          data={messages}
          itemContent={getItem}
          endReached={handleEndReached}
        />
      </div>
      <div className={css.footer}>
        <input
          type="text"
          className={css.textInput}
          placeholder="Message text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              handleSend();
            }
          }}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
};

import { gql } from "@apollo/client";

export const GET_MESSAGES = gql`
  query GetMessages(
    $first: Int
    $after: MessagesCursor
    $before: MessagesCursor
  ) {
    messages(first: $first, after: $after, before: $before) {
      pageInfo {
        endCursor
        hasNextPage
        hasPreviousPage
        startCursor
      }
      edges {
        cursor
        node {
          id
          sender
          status
          text
          updatedAt
        }
      }
    }
  }
`;

export const SEND_MESSAGE = gql`
  mutation SendMessage($text: String!) {
    sendMessage(text: $text) {
      id
      text
      sender
      status
      updatedAt
    }
  }
`;

export const ON_NEW_MESSAGE = gql`
  subscription OnNewMessage {
    messageAdded {
      id
      text
      sender
      status
      updatedAt
    }
  }
`;

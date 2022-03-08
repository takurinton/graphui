import { DocumentNode, visit } from 'graphql';
import React, { useContext } from 'react';

type TransformerContextType = {
  updateNode(newValue: any): void;
};

const RendererContext = React.createContext<TransformerContextType>(null as any);

export const useTransformerContext = () => {
  return useContext(RendererContext);
}

export const Provider = ({
  children,
  root,
  onChangeNode,
}: {
  children: React.ReactNode;
  root: DocumentNode;
  onChangeNode: (root: DocumentNode) => void;
}) => {
  const api: TransformerContextType = {
    updateNode(newValue) {
      console.log(newValue)
      // onChangeNode(newNode);
    },
  };
  return <RendererContext.Provider value={api}>{children}</RendererContext.Provider>;
}
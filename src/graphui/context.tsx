import { DocumentNode, visit } from 'graphql';
import React, { useContext } from 'react';

type TransformerContextType = {
    updateNode(name: string, value: string): void;
    updatePage(page: number): void;
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
        updateNode(name, value) {
            const newNode = visit(root, {
                Argument: arg => {
                    if (arg.name.value === name) {
                        return {
                            ...arg,
                            value: {
                                ...arg.value,
                                value,
                            }
                        }
                    }
                }
            })
            onChangeNode(newNode);
        },
        updatePage(page) {
            const newNode = visit(root, {
                Argument: arg => {
                    if (arg.name.value === 'page') {
                        return {
                            ...arg,
                            value: {
                                ...arg.value,
                                value: page
                            }
                        }
                    }
                }
            });
            onChangeNode(newNode);
        }
    };
    return <RendererContext.Provider value={api}>{children}</RendererContext.Provider>;
}
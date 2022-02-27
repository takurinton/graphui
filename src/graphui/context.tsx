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
            const values = newValue.map((v: any) => v.value);
            const newNode = visit(root, {
                // SelectionSet: selection => {
                //     console.log(selection.selections)
                //     // ここは強引すぎる
                //     // @ts-ignore
                //     if (selection.selections[0].selectionSet === undefined) {
                //         const newSelections = selection.selections.filter(selection => values.includes(selection.name.value));
                //         return {
                //             ...selection,
                //             selections: newSelections,
                //         }
                //     }
                // },

                // field でみるのはなんか違う気がするけど、selectionSet だと一意に定まらないのでもう一度ドキュメントを読む
                Field: field => {
                    // if (field.name.value === 'me') {
                    //     return {
                    //         ...field,
                    //         name: {
                    //             ...field.name,
                    //             value: 'hoge'
                    //         }
                    //     }
                    // }

                    if (field.name.value !== 'me' && !values.includes(field.name.value)) {
                        // return {
                        //     ...field,
                        //     name: {
                        //         ...field.name,
                        //     }
                        // }
                        return undefined;
                    }
                    // return field;
                }
            });
            onChangeNode(newNode);
        },
    };
    return <RendererContext.Provider value={api}>{children}</RendererContext.Provider>;
}
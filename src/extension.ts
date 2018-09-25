import * as sourcegraph from 'sourcegraph'
import * as rpc from 'vscode-ws-jsonrpc'

const PORT = 1234

export function activate(): void {
    const webSocket = new WebSocket('ws://localhost:' + PORT)
    rpc.listen({
        webSocket,
        onConnection: (connection: rpc.MessageConnection) => {
            connection.listen()

            sourcegraph.languages.registerHoverProvider(['*'], {
                provideHover: async (doc, pos) => {
                    return connection.sendRequest<sourcegraph.Hover>('hover', doc, pos).then(hover => {
                        return (
                            hover && {
                                contents: {
                                    value: '```python\n' + (hover.contents as any).join('\n') + '\n```',
                                    kind: sourcegraph.MarkupKind.Markdown,
                                },
                            }
                        )
                    })
                },
            })

            sourcegraph.languages.registerDefinitionProvider(['*'], {
                provideDefinition: async (doc, pos) => {
                    return connection.sendRequest<any>('definition', doc, pos).then(definition => {
                        return (
                            definition &&
                            new sourcegraph.Location(
                                new sourcegraph.URI(doc.uri),
                                new sourcegraph.Range(
                                    new sourcegraph.Position(definition.start.line, definition.start.character),
                                    new sourcegraph.Position(definition.end.line, definition.end.character)
                                )
                            )
                        )
                    })
                },
            })
        },
    })
}

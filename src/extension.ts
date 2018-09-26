import * as sourcegraph from 'sourcegraph'
import * as rpc from 'vscode-ws-jsonrpc'
import { BehaviorSubject, Unsubscribable, Subscription, EMPTY, of } from 'rxjs'
import { map, switchMap, distinct, distinctUntilChanged } from 'rxjs/operators'

interface FullSettings {
    'graphql.langserver-address': string
}

type Settings = Partial<FullSettings>

function connectTo(address: string): Promise<rpc.MessageConnection> {
    return new Promise(resolve => {
        const webSocket = new WebSocket(address)
        rpc.listen({
            webSocket,
            onConnection: (connection: rpc.MessageConnection) => {
                resolve(connection)
            },
        })
    })
}

export function activate(): void {
    function afterActivate() {
        const address = sourcegraph.configuration.get<Settings>().get('graphql.langserver-address')
        if (!address) {
            console.log('No graphql.langserver-address was set, exiting.')
            return
        }

        connectTo(address).then((connection: rpc.MessageConnection) => {
            connection.listen()

            const docSelector = [{ pattern: '*.{graphql,gql,schema}' }]

            sourcegraph.languages.registerHoverProvider(docSelector, {
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

            sourcegraph.languages.registerDefinitionProvider(docSelector, {
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
        })
    }
    // Error creating extension host: Error: Configuration is not yet available.
    // `sourcegraph.configuration.get` is not usable until after the extension
    // `activate` function is finished executing. This is a known issue and will
    // be fixed before the beta release of Sourcegraph extensions. In the
    // meantime, work around this limitation by deferring calls to `get`.
    setTimeout(afterActivate, 0)
}

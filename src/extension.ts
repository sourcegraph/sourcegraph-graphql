import * as sourcegraph from 'sourcegraph'
import { ajax } from 'rxjs/ajax'

interface FullSettings {
    'graphql.langserver-address': string
}

type Settings = Partial<FullSettings>

export function activate(): void {
    function afterActivate() {
        const address = sourcegraph.configuration.get<Settings>().get('graphql.langserver-address')
        if (!address) {
            console.log('No graphql.langserver-address was set, exiting.')
            return
        }

        const docSelector = [{ pattern: '*.{graphql,gql,schema}' }]

        sourcegraph.languages.registerHoverProvider(docSelector, {
            provideHover: async (doc, pos) => {
                return ajax({
                    method: 'POST',
                    url: address,
                    body: JSON.stringify({ method: 'hover', doc, pos }),
                    responseType: 'json',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
                    .toPromise()
                    .then(response => {
                        return (
                            response &&
                            response.response &&
                            response.response.contents && {
                                contents: {
                                    // python syntax highlighting works pretty well for GraphQL
                                    value: '```python\n' + response.response.contents.join('\n') + '\n```',
                                    kind: sourcegraph.MarkupKind.Markdown,
                                },
                            }
                        )
                    })
            },
        })

        sourcegraph.languages.registerDefinitionProvider(docSelector, {
            provideDefinition: async (doc, pos) => {
                return ajax({
                    method: 'POST',
                    url: address,
                    body: JSON.stringify({ method: 'definition', doc, pos }),
                    responseType: 'json',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
                    .toPromise()
                    .then(response => {
                        return (
                            response &&
                            response.response.definition &&
                            new sourcegraph.Location(
                                new sourcegraph.URI(doc.uri),
                                new sourcegraph.Range(
                                    new sourcegraph.Position(
                                        response.response.definition.start.line,
                                        response.response.definition.start.character
                                    ),
                                    new sourcegraph.Position(
                                        response.response.definition.end.line,
                                        response.response.definition.end.character
                                    )
                                )
                            )
                        )
                    })
            },
        })
    }
    // Error creating extension host: Error: Configuration is not yet available.
    // `sourcegraph.configuration.get` is not usable until after the extension
    // `activate` function is finished executing. This is a known issue and will
    // be fixed before the beta release of Sourcegraph extensions. In the
    // meantime, work around this limitation by deferring calls to `get`.
    setTimeout(afterActivate, 0)
}

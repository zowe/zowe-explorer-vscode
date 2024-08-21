/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

/**
 * HTML template that is compiled with Mustache to load a WebView instance at runtime.
 */
const HTMLTemplate: string = /*html*/ `
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>{{ title }}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
            http-equiv="Content-Security-Policy"
            content="default-src 'none'; font-src data: {{ cspSource }}; img-src data: vscode-resource: https:; script-src 'nonce-{{ nonce }}';
            style-src {{ cspSource }} vscode-resource: 'unsafe-inline' http: https: data:;"
        />
        <base href="{{ uris.resource.build }}">
        {{{ style }}}
    </head>
    <body>
        <noscript>You'll need to enable JavaScript to run this app.</noscript>
        {{{ startup }}}
        <div id="webviewRoot"></div>
        <script type="module" nonce="{{ nonce }}" src="{{ uris.resource.script }}" />
    </body>
</html>
`;

export default HTMLTemplate;

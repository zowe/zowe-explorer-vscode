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
 * HTML template that is compiled with Handlebars to load a WebView instance at runtime.
 */
const HTMLTemplate: string = `
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>{{ title }}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta 
            http-equiv="Content-Security-Policy" 
            content="default-src 'none'; img-src vscode-resource: https:; script-src 'nonce-{{ nonce }}';
            style-src vscode-resource: 'unsafe-inline' http: https: data:;"
        />
        <base href="{{ uris.resource.build }}">
    </head>
    <body>
        <noscript>You'll need to enable JavaScript to run this app.</noscript>
        <div id="webviewRoot"></div>
        <script type="module" nonce="{{ nonce }}" src="{{ uris.resource.script }}" />
    </body>
</html>
`;

export default HTMLTemplate;

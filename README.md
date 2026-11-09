# Angular19
Base project for Web Applications:
- [Angular 21](https://github.com/angular/angular-cli)
  - SSR
  - Zoneless
  - OnPush and Standalone components
  - GlobalService using Signals
- [Taiga UI](https://taiga-ui.dev/), with mobile first templates
- [Tailwind 4](https://tailwindcss.com/)
- ESLINT

With love, by Gabri Mejía ❤

[Live DEMO](https://angular-app-template.netlify.app/home) 🚀

## Development server

Use npm and a supported Node.js version: `^20.19.0`, `^22.12.0`, or `^24.0.0`.
Install dependencies with `npm ci`.

To start a local development server, run:

```bash
npm start
```

This will start the server with Hot Module Replacement (HMR) disabled, which allows `@defer` blocks to work properly with lazy loading.

If you prefer to use HMR (note that this will cause all `@defer` block dependencies to be loaded eagerly), you can run:

```bash
npm run start:hmr
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

The initial bundle is about 900 kB raw (about 180 kB transferred), mostly Taiga UI.
The budgets in `angular.json` are set just above that (warning at 950 kB, error at
1.1 MB) so that growth is noticed.

## Running unit tests

To execute unit tests with [Vitest](https://vitest.dev/), use:

```bash
npm test
```

For a single run with a coverage report, use `npm run test:ci`. The HTML report
is written to `coverage/`. The build fails below 80% of statements, branches,
functions and lines. Entry points (`main*.ts`, `server.ts`) and test helpers are
excluded from the coverage. `npm run typecheck:spec` type checks the test files.

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Notes on Server-Side Rendering (SSR)

Map initialization is skipped during server-side rendering because Leaflet
requires browser APIs. It starts after the deferred map element is rendered
in the browser.

After `npm run build`, run `npm run serve:ssr:angular19` to start the production
server. Localhost is allowed by default. When hosting the SSR server elsewhere,
configure trusted hostnames with `NG_ALLOWED_HOSTS` as described in the
[Angular SSR security documentation](https://angular.dev/best-practices/security#preventing-server-side-request-forgery-ssrf).
Run `npm run test:ssr` after the build to smoke-test prerendered pages and translations.

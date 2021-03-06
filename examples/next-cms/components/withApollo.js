import { Router } from "next/router";
import fetch from "isomorphic-unfetch";
import React from "react";
import PropTypes from "prop-types";
import { Provider } from "@department/apollo-component";
import { renderState } from "@department/apollo-component/state";
import ApolloClient, { ApolloLink, HttpLink } from "apollo-client-preset";

export default Component =>
  class extends React.Component {
    static displayName = `withApollo(${Component.displayName ||
      Component.name ||
      "<unnamed>"})`;

    static async getInitialProps(ctx) {
      // create a client in ssr mode
      // and render the state of the root component
      // to populate the cache
      const client = createClient({ ssrMode: !!ctx.req });

      // wrapping the component with a RouterContext to
      // make the next/router.withRouter HoC work
      const router = {
        pathname: ctx.pathname,
        query: ctx.query,
        asPath: ctx.asPath
      };

      const props = {
        query: ctx.query
      };
      if (Component.getInitialProps) {
        Object.assign(props, await Component.getInitialProps(ctx));
      }

      console.time("renderState");
      try {
        await renderState(
          client,
          <RouterContext router={router}>
            <Component {...props} />
          </RouterContext>,
          {
            maxDepth:
              ctx.query.maxDepth !== undefined ? +ctx.query.maxDepth : Infinity
          }
        );
      } catch (err) {
        // you can let the error throw here
        // or ignore it and let the client side
        // handle it inline
        console.error("failed to render state:", err);
      }
      console.timeEnd("renderState");

      return { ...props, state: client.cache.extract() };
    }

    // an apollo client for client side rendering
    // rehydrated with the state from ssr
    client = createClient({}, this.props.state);

    render() {
      return (
        <Provider client={this.client}>
          <Component {...this.props} />
        </Provider>
      );
    }
  };

// RouterContext emulates the App component used in next in that it
// adds a router object to the context
class RouterContext extends React.Component {
  static childContextTypes = {
    router: PropTypes.object
  };

  getChildContext() {
    return {
      router: this.props.router
    };
  }

  render() {
    return this.props.children;
  }
}

const createClient = (opts = {}, state) => {
  const client = new ApolloClient({
    link: ApolloLink.from([logs(opts), auth(opts), http(opts)]),
    ...opts
  });

  if (state) {
    client.cache.restore(state);
  }
  return client;
};

const http = () =>
  new HttpLink({
    fetch,
    uri: "https://api.graph.cool/simple/v1/cjajyp5o72c7x01586g85am6w"
  });

const auth = ({ token }) =>
  new ApolloLink((operation, forward) => {
    operation.setContext({
      headers: {
        authorization: token || null
      }
    });
    return forward(operation);
  });

const logs = ({}) =>
  new ApolloLink((operation, forward) => {
    const t = Date.now();
    return forward(operation).map(response => {
      console.log(
        "request for %s took %sms",
        operation.operationName,
        Date.now() - t
      );
      return response;
    });
  });

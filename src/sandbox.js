import 'regenerator-runtime/runtime';
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import Scrollable from './components/Scrollable';
import setupHighlighter from '../devtools/src/content-script/highlighter';
import cssPath from './lib/cssPath';
import { getQueryAdvise } from './lib';
import parser from './parser';

const state = {
  queriedNodes: [],
  markup: '',
  query: '',
  rootNode: null,
  highlighter: null,
};

function postMessage(action) {
  top.postMessage(
    {
      source: 'testing-playground-sandbox',
      ...action,
    },
    top.location.origin,
  );
}

function runQuery(rootNode, query) {
  const result = parser.parse({ rootNode, query });
  state.queriedNodes = result.elements.map((elem) => elem.target);
  state.highlighter.highlight({ nodes: state.queriedNodes });
  return result;
}

function setInnerHTML(node, html) {
  const doc = node.ownerDocument;
  node.innerHTML = html;

  for (let prevScript of node.querySelectorAll('script')) {
    const newScript = doc.createElement('script');

    for (let attribute of prevScript.attributes) {
      newScript[attribute.name] = attribute.value;
    }

    newScript.type = prevScript.type || 'text/javascript';

    const text =
      newScript.type === 'text/javascript'
        ? `(function() { ${prevScript.innerHTML} })()`
        : prevScript.innerHTML;

    newScript.appendChild(doc.createTextNode(text));
    prevScript.parentNode.replaceChild(newScript, prevScript);
  }
}

function Sandbox() {
  useEffect(() => {
    setTimeout(() => {
      state.rootNode = document.getElementById('sandbox');

      state.highlighter = setupHighlighter({
        view: state.rootNode,
        onSelectNode,
      });

      // let the parent frame know where ready to eval code
      postMessage({ type: 'SANDBOX_LOADED' });
    }, 0);
  }, []);

  return (
    <div
      className="pr-1 relative w-screen h-screen overflow-hidden"
      onMouseEnter={() => {
        state.highlighter?.clear();
        state.highlighter?.start({ stopOnClick: false, blockEvents: false });
      }}
      onMouseLeave={() => {
        state.highlighter?.stop();
        state.highlighter.highlight({ nodes: state.queriedNodes });
      }}
    >
      <Scrollable id="sandbox" />
    </div>
  );
}

function onSelectNode(node, { origin }) {
  if (!origin || origin === 'script') {
    return;
  }

  const { suggestion, data } = getQueryAdvise({
    element: node,
    rootNode: state.rootNode,
  });

  if (!suggestion?.expression) {
    return;
  }

  const action = {
    type: origin === 'click' ? 'SELECT_NODE' : 'HOVER_NODE',
    suggestion,
    data,
    cssPath: cssPath(node, true).toString(),
  };

  // toString can't be serialized for postMessage
  delete action.query?.toString;
  postMessage(action);
}

function updateSandbox(rootNode, markup, query) {
  postMessage({ type: 'SANDBOX_BUSY' });
  setInnerHTML(rootNode, markup);
  runQuery(rootNode, query);
  postMessage({ type: 'SANDBOX_READY' });
}

function onMessage({ source, data }) {
  if (source !== top || data.source !== 'testing-playground') {
    return;
  }

  switch (data.type) {
    case 'POPULATE_SANDBOX': {
      state.query = data.query;
      state.markup = data.markup;
      break;
    }

    case 'SET_MARKUP': {
      state.markup = data.markup;
      break;
    }

    case 'SET_QUERY': {
      state.query = data.query;
      break;
    }
  }

  updateSandbox(state.rootNode, state.markup, state.query);
}

window.addEventListener('message', onMessage, false);

ReactDOM.render(<Sandbox />, document.getElementById('app'));

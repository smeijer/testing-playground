import React, { useRef, useCallback, useState } from 'react';
import { eventMap } from '@testing-library/dom/dist/event-map';
import throttle from 'lodash.throttle';

import Preview from './Preview';
import MarkupEditor from './MarkupEditor';
import usePlayground from '../hooks/usePlayground';
import Layout from './Layout';
import { useParams } from 'react-router-dom';
import DomEventsTable from './DomEventsTable';

function targetToString() {
  return [
    this.tagName.toLowerCase(),
    this.id && `#${this.id}`,
    this.name && `[name="${this.name}"]`,
    this.htmlFor && `[for="${this.htmlFor}"]`,
    this.value && `[value="${this.value}"]`,
    this.checked !== null && `[checked=${this.checked}]`,
  ]
    .filter(Boolean)
    .join('');
}

function getElementData(element) {
  const value =
    element.tagName === 'SELECT' && element.multiple
      ? element.selectedOptions.length > 0
        ? JSON.stringify(
            Array.from(element.selectedOptions).map((o) => o.value),
          )
        : null
      : element.value;

  const hasChecked = element.type === 'checkbox' || element.type === 'radio';

  return {
    tagName: element.tagName.toLowerCase(),
    id: element.id || null,
    name: element.name || null,
    htmlFor: element.htmlFor || null,
    value: value || null,
    checked: hasChecked ? !!element.checked : null,
    toString: targetToString,
  };
}

function addLoggingEvents(node, log) {
  function createEventLogger(eventType) {
    return function logEvent(event) {
      if (event.target === event.currentTarget) {
        return;
      }

      log({
        event: eventType,
        target: getElementData(event.target),
      });
    };
  }
  const eventListeners = [];
  Object.keys(eventMap).forEach((name) => {
    eventListeners.push({
      name: name.toLowerCase(),
      listener: node.addEventListener(
        name.toLowerCase(),
        createEventLogger({ name, ...eventMap[name] }),
        true,
      ),
    });
  });

  return eventListeners;
}

function DomEvents() {
  const { gistId, gistVersion } = useParams();

  const buffer = useRef([]);
  const previewRef = useRef();

  const sortDirection = useRef('asc');
  const [appendMode, setAppendMode] = useState('bottom');
  const [state, dispatch] = usePlayground({ gistId, gistVersion });
  const { markup, result, status, dirty, settings } = state;

  const [eventCount, setEventCount] = useState(0);
  const [eventListeners, setEventListeners] = useState([]);

  const changeSortDirection = () => {
    const newDirection = sortDirection.current === 'desc' ? 'asc' : 'desc';
    buffer.current = buffer.current.reverse();
    setAppendMode(newDirection === 'desc' ? 'top' : 'bottom');
    sortDirection.current = newDirection;
  };

  const reset = () => {
    buffer.current = [];
    setEventCount(0);
  };

  const flush = useCallback(
    throttle(() => setEventCount(buffer.current.length), 16, {
      leading: false,
    }),
    [setEventCount],
  );

  const setPreviewRef = useCallback((node) => {
    if (node) {
      previewRef.current = node;
      const eventListeners = addLoggingEvents(node, (event) => {
        const log = {
          id: buffer.current.length + 1,
          type: event.event.EventType,
          name: event.event.name,
          element: event.target.tagName,
          selector: event.target.toString(),
        };
        if (sortDirection.current === 'desc') {
          buffer.current.splice(0, 0, log);
        } else {
          buffer.current.push(log);
        }

        setTimeout(flush, 0);
      });
      setEventListeners(eventListeners);
    } else if (previewRef.current) {
      eventListeners.forEach((event) =>
        previewRef.current.removeEventListener(event.name, event.listener),
      );
      previewRef.current = null;
    }
  }, []);

  const bufferValues = Object.values(buffer.current);
  const getUniqueEventsByProperty = (property) => [
    ...new Set(bufferValues.map((event) => event[property])),
  ];
  const getOptionsByProperty = (property) =>
    getUniqueEventsByProperty(property).map((eventProperty) => ({
      label: eventProperty,
      value: eventProperty,
    }));

  const typeOptions = getOptionsByProperty('type');
  const nameOptions = getOptionsByProperty('name');

  return (
    <Layout
      dispatch={dispatch}
      gistId={gistId}
      dirty={dirty}
      status={status}
      settings={settings}
    >
      <div className="flex flex-col h-auto md:h-full w-full">
        <div className="editor p-4 markup-editor gap-4 md:gap-8 md:h-56 flex-auto grid-cols-1 md:grid-cols-2">
          <div className="flex-auto relative h-56 md:h-full">
            <MarkupEditor markup={markup} dispatch={dispatch} />
          </div>

          <div className="flex-auto h-56 md:h-full">
            <Preview
              forwardedRef={setPreviewRef}
              markup={markup}
              elements={result?.elements}
              accessibleRoles={result?.accessibleRoles}
              dispatch={dispatch}
              variant="minimal"
            />
          </div>
        </div>

        <DomEventsTable
          eventCount={eventCount}
          reset={reset}
          data={buffer.current}
          typeOptions={typeOptions}
          nameOptions={nameOptions}
          onChangeSortDirection={changeSortDirection}
          appendMode={appendMode}
        />
      </div>
    </Layout>
  );
}

export default DomEvents;

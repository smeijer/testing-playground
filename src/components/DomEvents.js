import { eventMap } from '@testing-library/dom/dist/event-map';
import throttle from 'lodash.throttle';
import AutoSizer from 'react-virtualized-auto-sizer';

import EmptyStreetImg from '../images/EmptyStreetImg';

import IconButton from './IconButton';
import { VirtualScrollable } from './Scrollable';
import StickyList from './StickyList';
import TrashcanIcon from './TrashcanIcon';

function onStateChange({ markup, query, result }) {
  state.save({ markup, query });
  state.updateTitle(result?.expression?.expression);
}

const initialValues = state.load() || {};

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
    checked: hasChecked ? Boolean(element.checked) : null,
    toString: targetToString,
  };
}

const createEventLogger = (log, eventType) => (event) => {
  if (event.target === event.currentTarget) {
    return;
  }

  log({
    event: eventType,
    target: getElementData(event.target),
  });
};

const addLoggingEvents = (node, log) =>
  Object.entries(eventMap).map(([name, event]) => ({
    name: name.toLowerCase(),
    listener: node.addEventListener(
      name.toLowerCase(),
      createEventLogger(log, { name, ...event }),
      true,
    ),
  }));

function EventRecord({ index, style, data }) {
  const { id, event, target } = data[index];

  return (
    <div
      className={`w-full h-8 flex items-center text-sm ${
        index % 2 ? 'bg-gray-100' : ''
      }`}
      style={style}
    >
      <div className="p-2 flex-none w-16">{id}</div>

      <div className="p-2 flex-none w-32">{event.EventType}</div>
      <div className="p-2 flex-none w-32">{event.name}</div>

      <div className="p-2 flex-none w-40">{target.tagName}</div>
      <div className="p-2 flex-auto whitespace-no-wrap">
        {target.toString()}
      </div>
    </div>
  );
}

const noop = () => undefined;
function DomEvents() {
  const [{ markup, result }, dispatch] = usePlayground({
    onChange: onStateChange,
    ...initialValues,
  });

  const buffer = useRef([]);
  const previewRef = useRef();
  const listRef = useRef();

  const [eventCount, setEventCount] = useState(0);
  const [eventListeners, setEventListeners] = useState([]);

  const reset = () => {
    buffer.current = [];
    setEventCount(0);
  };

  const flush = useCallback(
    throttle(() => setEventCount(buffer.current.length), 16, {
      leading: false,
    }),
    [],
  );

  const setPreviewRef = useCallback((node) => {
    if (node) {
      previewRef.current = node;
      const eventListeners = addLoggingEvents(node, (event) => {
        event.id = buffer.current.length;
        buffer.current.push(event);
        setTimeout(flush, 0);
      });
      setEventListeners(eventListeners);
    } else if (previewRef.current) {
      eventListeners.forEach(({ name, listener }) =>
        previewRef.current.removeEventListener(name, listener),
      );
      previewRef.current = null;
    }
  }, []);

  return (
    <div className="flex flex-col h-auto md:h-full w-full">
      <div className="editor markup-editor gap-4 md:gap-8 md:h-56 flex-auto grid-cols-1 md:grid-cols-2">
        <div className="flex-auto relative h-56 md:h-full">
          <MarkupEditor markup={markup} dispatch={dispatch} />
        </div>

        <div className="flex-auto h-56 md:h-full" ref={setPreviewRef}>
          <Preview
            markup={markup}
            elements={result.elements}
            accessibleRoles={result.accessibleRoles}
            dispatch={noop}
            variant="minimal"
          />
        </div>
      </div>

      <div className="flex-none h-8" />

      <div className="editor md:h-56 flex-auto overflow-hidden">
        <div className="h-56 md:h-full w-full flex flex-col">
          <div className="h-8 flex items-center w-full text-sm font-bold">
            <div className="p-2 w-16">#</div>

            <div className="p-2 w-32">type</div>
            <div className="p-2 w-32">name</div>

            <div className="p-2 w-40">element</div>
            <div className="flex-auto p-2 flex justify-between">
              <span>selector</span>
              <IconButton title="clear event log" onClick={reset}>
                <TrashcanIcon />
              </IconButton>
            </div>
          </div>

          <div className="flex-auto relative overflow-hidden">
            {eventCount === 0 ? (
              <div className="flex w-full h-full opacity-50 items-end justify-center">
                <EmptyStreetImg height="80%" />
              </div>
            ) : (
              <AutoSizer>
                {({ width, height }) => (
                  <StickyList
                    follow={true}
                    mode="bottom"
                    ref={listRef}
                    height={height}
                    itemCount={eventCount}
                    itemData={buffer.current}
                    itemSize={32}
                    width={width}
                    outerElementType={VirtualScrollable}
                  >
                    {EventRecord}
                  </StickyList>
                )}
              </AutoSizer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DomEvents;

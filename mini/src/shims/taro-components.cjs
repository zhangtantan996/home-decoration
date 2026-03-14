const React = require('react');

const toEvent = (value) => ({ detail: { value } });

const stripProps = (props, keys) => {
  const next = {};
  Object.keys(props || {}).forEach((key) => {
    if (!keys.includes(key)) {
      next[key] = props[key];
    }
  });
  return next;
};

function View(props) {
  const htmlProps = stripProps(props, ['children']);
  return React.createElement('div', htmlProps, props.children);
}

function Text(props) {
  const htmlProps = stripProps(props, ['children']);
  return React.createElement('span', htmlProps, props.children);
}

function Image(props) {
  const htmlProps = stripProps(props, ['mode']);
  const style = Object.assign({}, props.style || {});
  if (props.mode === 'aspectFill') {
    style.objectFit = 'cover';
  } else if (props.mode === 'aspectFit') {
    style.objectFit = 'contain';
  }
  htmlProps.style = style;
  return React.createElement('img', htmlProps);
}

function ScrollView(props) {
  const htmlProps = stripProps(props, ['children', 'scrollX', 'scrollY']);
  const style = Object.assign({}, props.style || {});
  if (props.scrollX) style.overflowX = 'auto';
  if (props.scrollY) style.overflowY = 'auto';
  style.WebkitOverflowScrolling = 'touch';
  htmlProps.style = style;
  return React.createElement('div', htmlProps, props.children);
}

function Input(props) {
  const htmlProps = stripProps(props, ['onInput', 'nativeProps', 'maxlength']);
  htmlProps.type = props.type === 'phone' ? 'tel' : (props.type || 'text');
  htmlProps.maxLength = props.maxlength;
  htmlProps.onChange = (event) => {
    const value = event.target.value;
    props.onInput && props.onInput(toEvent(value));
    props.onChange && props.onChange(toEvent(value));
    props.nativeProps && props.nativeProps.onKeyPress && props.nativeProps.onKeyPress(event);
  };
  return React.createElement('input', htmlProps);
}

function Button(props) {
  const htmlProps = stripProps(props, ['children', 'loading']);
  htmlProps.disabled = props.disabled || props.loading;
  return React.createElement('button', htmlProps, props.children);
}

function Picker(props) {
  const outerProps = stripProps(props, ['children', 'mode', 'value', 'start', 'end', 'onChange']);
  if (props.mode === 'date') {
    return React.createElement(
      'label',
      outerProps,
      React.createElement('input', {
        type: 'date',
        value: props.value,
        min: props.start,
        max: props.end,
        onChange: (event) => props.onChange && props.onChange(toEvent(event.target.value)),
      }),
      props.children,
    );
  }

  return React.createElement('div', outerProps, props.children);
}

module.exports = {
  View,
  Text,
  Image,
  ScrollView,
  Input,
  Button,
  Picker,
};

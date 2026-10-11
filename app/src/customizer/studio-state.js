// The Studio's editing state as a pure reducer: colours per part, the
// selected part and an undo history. React holds it in useReducer; keeping
// it free of React makes every edit rule testable in node.

export const HISTORY_LIMIT = 60;

export function initialStudioState(studio, savedColors = null) {
  return {
    colors: studio.normalizeColors(savedColors ?? studio.defaultColors),
    selectedId: studio.parts[0].id,
    past: [],
    // Consecutive edits of one part (dragging a colour picker, typing a code)
    // are one undo step.
    editing: null,
  };
}

const push = (state, colors, editing = null) => ({
  ...state,
  colors,
  editing,
  past: [...state.past, state.colors].slice(-HISTORY_LIMIT),
});

const sameColors = (a, b) => Object.keys(a).every((id) => a[id] === b[id]);

export function studioReducer(state, action, studio) {
  switch (action.type) {
    case "select":
      return studio.partById[action.id] ? { ...state, selectedId: action.id, editing: null } : state;

    case "color": {
      const id = action.id ?? state.selectedId;
      const color = studio.normalizeColors({ ...state.colors, [id]: action.color })[id];
      if (!studio.partById[id] || color === state.colors[id]) return state;
      const colors = { ...state.colors, [id]: color };
      return state.editing === id ? { ...state, colors } : push(state, colors, id);
    }

    case "apply": {
      const colors = studio.normalizeColors(action.colors);
      return sameColors(colors, state.colors) ? state : push(state, colors);
    }

    case "resetPart": {
      const id = action.id ?? state.selectedId;
      const part = studio.partById[id];
      return !part || state.colors[id] === part.color ? state : push(state, { ...state.colors, [id]: part.color });
    }

    case "resetAll":
      return sameColors(studio.defaultColors, state.colors) ? state : push(state, { ...studio.defaultColors });

    case "undo": {
      if (!state.past.length) return state;
      const past = state.past.slice(0, -1);
      return { ...state, colors: state.past.at(-1), past, editing: null };
    }

    default:
      return state;
  }
}

export const colorsChanged = (studio, colors) => !sameColors(studio.defaultColors, colors);

// A random colourway drawn from a palette, one colour per part.
export function randomColors(studio, palette, random = Math.random) {
  return Object.fromEntries(studio.parts.map((part) => [part.id, palette[Math.floor(random() * palette.length)]]));
}

// design.colors (part id -> hex), or, for a design saved without it, rebuilt
// from the per-mesh colours the simulator reads.
export function savedDesignColors(studio, design) {
  if (!design) return null;
  if (design.colors && Object.keys(design.colors).length) return design.colors;
  const overrides = design.meshColors ?? {};
  const rebuilt = {};
  for (const [selector, part] of studio.partByTarget) {
    if (selector in overrides && !(part.id in rebuilt)) rebuilt[part.id] = overrides[selector];
  }
  return Object.keys(rebuilt).length ? rebuilt : null;
}

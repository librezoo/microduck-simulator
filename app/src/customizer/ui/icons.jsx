// Line icons, 24px grid, drawn for the Studio. They inherit currentColor and
// are decorative: the button that holds one carries the accessible name.
const paths = {
  play: <path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" stroke="none" />,
  arrow: <><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></>,
  download: <><path d="M12 4v11" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></>,
  chevron: <path d="m7 10 5 5 5-5" />,
  chevronRight: <path d="m10 7 5 5-5 5" />,
  home: <><path d="M4 11 12 4l8 7" /><path d="M6 9.5V20h12V9.5" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  minus: <path d="M5 12h14" />,
  shuffle: <><path d="M4 7h3c5 0 5 10 10 10h3" /><path d="m17 14 3 3-3 3" /><path d="M4 17h3c1.6 0 2.7-.9 3.7-2.2" /><path d="M14 7h3l3-3" /><path d="m17 4 3 3-3 3" /></>,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  reset: <><path d="M4 12a8 8 0 1 0 2.6-5.9" /><path d="M4 4v5h5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  dropper: <><path d="m14 4 6 6" /><path d="M16.5 6.5 6 17l-1 3 3-1L18.5 8.5" /><path d="M15 3.5 20.5 9" /></>,
  external: <><path d="M9 6H6v12h12v-3" /><path d="M13 5h6v6" /><path d="m19 5-8 8" /></>,
  close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
  sheetUp: <path d="m7 14 5-5 5 5" />,
  sheetDown: <path d="m7 10 5 5 5-5" />,
};

export default function Icon({ name, size = 18 }) {
  return (
    <svg
      className="lz-icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

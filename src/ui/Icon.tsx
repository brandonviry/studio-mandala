import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'add'
  | 'arrow-down'
  | 'arrow-up'
  | 'chevron'
  | 'close'
  | 'disk'
  | 'download'
  | 'duplicate'
  | 'eye'
  | 'eye-off'
  | 'flower'
  | 'folder'
  | 'generate'
  | 'guides'
  | 'help'
  | 'layers'
  | 'lock'
  | 'menu'
  | 'redo'
  | 'ring'
  | 'save'
  | 'settings'
  | 'spark'
  | 'trash'
  | 'undo'
  | 'unlock';

const paths: Record<IconName, ReactNode> = {
  add: <path d="M12 5v14M5 12h14" />,
  'arrow-down': <path d="m8 10 4 4 4-4" />,
  'arrow-up': <path d="m8 14 4-4 4 4" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  disk: <circle cx="12" cy="12" r="7" />,
  download: (
    <>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
      <path d="M5 19h14" />
    </>
  ),
  duplicate: (
    <>
      <rect x="8" y="8" width="11" height="11" rx="1" />
      <path d="M16 8V5H5v11h3" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  'eye-off': (
    <>
      <path d="m4 4 16 16" />
      <path d="M9.5 7.4A10 10 0 0 1 12 7c6.1 0 9.5 5 9.5 5a15 15 0 0 1-2.2 2.6M6.3 6.7C3.8 8.4 2.5 12 2.5 12s3.4 5 9.5 5c1 0 1.9-.1 2.7-.4" />
    </>
  ),
  flower: (
    <>
      <circle cx="12" cy="12" r="2.2" />
      <path d="M12 9.8c-2.6-2-3.4-4.5-1.7-6 1.7-1.5 3.4.6 1.7 6Zm2.2 2.2c2-2.6 4.5-3.4 6-1.7 1.5 1.7-.6 3.4-6 1.7ZM12 14.2c2.6 2 3.4 4.5 1.7 6-1.7 1.5-3.4-.6-1.7-6ZM9.8 12c-2 2.6-4.5 3.4-6 1.7-1.5-1.7.6-3.4 6-1.7Z" />
    </>
  ),
  folder: <path d="M3 7h7l2 2h9v10H3V7Zm0 0V5h7l2 2" />,
  generate: (
    <>
      <path d="M5 16a8 8 0 0 1 12.8-9.4L20 9" />
      <path d="M20 4v5h-5M19 13a8 8 0 0 1-12.8 4.4L4 15" />
      <path d="M4 20v-5h5" />
    </>
  ),
  guides: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v20M2 12h20" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.3 2.3 0 1 1 3.5 2c-.9.5-1.3 1-1.3 2M12 17h.01" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m4.5 12 7.5 4 7.5-4M4.5 16l7.5 4 7.5-4" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  menu: <path d="M5 7h14M5 12h14M5 17h14" />,
  redo: (
    <>
      <path d="m15 5 4 4-4 4" />
      <path d="M19 9h-7a6 6 0 0 0-6 6v2" />
    </>
  ),
  ring: (
    <>
      <circle cx="12" cy="4.5" r="2" />
      <circle cx="18.5" cy="8" r="2" />
      <circle cx="18.5" cy="16" r="2" />
      <circle cx="12" cy="19.5" r="2" />
      <circle cx="5.5" cy="16" r="2" />
      <circle cx="5.5" cy="8" r="2" />
    </>
  ),
  save: (
    <>
      <path d="M4 4h13l3 3v13H4V4Z" />
      <path d="M8 4v6h8V4M8 20v-6h8v6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
    </>
  ),
  spark: (
    <>
      <path d="m12 2 1.3 5.7L19 9l-5.7 1.3L12 16l-1.3-5.7L5 9l5.7-1.3L12 2Z" />
      <path d="m19 15 .6 2.4L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.6L19 15Z" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  undo: (
    <>
      <path d="m9 5-4 4 4 4" />
      <path d="M5 9h7a6 6 0 0 1 6 6v2" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 7.5-2" />
    </>
  ),
};

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export function Icon({ name, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
      {...props}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      >
        {paths[name]}
      </g>
    </svg>
  );
}

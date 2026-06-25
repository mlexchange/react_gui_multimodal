const scatteringIcons = {
  horizontalLinecut: (
    <svg viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="34" height="32" stroke="#464B53" />
      <line x1="3" y1="16.5" x2="32" y2="16.5" stroke="#ED4547" />
    </svg>
  ),
  verticalLinecut: (
    <svg viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="34" height="32" stroke="#464B53" />
      <line x1="18.5" y1="30" x2="18.5" y2="3" stroke="#ED4547" />
    </svg>
  ),
  inclinedLinecut: (
    <svg viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="34" height="32" stroke="#464B53" />
      <line
        x1="8.62037"
        y1="27.6746"
        x2="26.6204"
        y2="6.6746"
        stroke="#ED4547"
      />
    </svg>
  ),
  azimuthalIntegration: (
    <svg viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="34" height="32" stroke="#464B53" />
      <circle cx="17.5" cy="16.5" r="9" stroke="#ED4547" />
    </svg>
  ),
  sampleDetectorDistance: (
    <svg viewBox="0 0 33 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        opacity="0.3"
        d="M5.30005 16.0002L29.3 3.2002V28.8002L5.30005 16.0002Z"
        fill="#999999"
        stroke="#666666"
        strokeWidth="0.5"
      />
      <path
        d="M3.16667 18.6668C4.63943 18.6668 5.83333 17.4729 5.83333 16.0002C5.83333 14.5274 4.63943 13.3335 3.16667 13.3335C1.69391 13.3335 0.5 14.5274 0.5 16.0002C0.5 17.4729 1.69391 18.6668 3.16667 18.6668Z"
        fill="#999999"
        stroke="black"
      />
      <path
        d="M30.6333 2.6665H29.0333C28.7388 2.6665 28.5 2.81574 28.5 2.99984V28.9998C28.5 29.1839 28.7388 29.3332 29.0333 29.3332H30.6333C30.9279 29.3332 31.1667 29.1839 31.1667 28.9998V2.99984C31.1667 2.81574 30.9279 2.6665 30.6333 2.6665Z"
        fill="#999999"
        stroke="black"
      />
      <path d="M9.83337 16L25.8334 16" stroke="black" strokeWidth="1.5" />
      <path
        d="M7.16663 16.0002L9.83329 13.3335V18.6668L7.16663 16.0002Z"
        fill="black"
      />
      <path
        d="M27.1666 16.0002L24.5 13.3335V18.6668L27.1666 16.0002Z"
        fill="black"
      />
    </svg>
  ),
  monochromator: (
    <svg viewBox="0 0 56 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <mask
        id="mask0_mono"
        style={{ maskType: "luminance" }}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="56"
        height="32"
      >
        <path d="M56 0H0V32H56V0Z" fill="white" />
      </mask>
      <g mask="url(#mask0_mono)">
        <path
          d="M42.982 30.2806H10.6476L26.8148 1.34863L42.982 30.2806Z"
          fill="url(#paint0_mono)"
          stroke="#D9D9D9"
          strokeWidth="0.5"
        />
        <path
          opacity="0.6"
          d="M35.4074 16.7481L19.7037 14.2061L35.8519 17.9444L51.7037 27.2154V24.9724L35.4074 16.7481Z"
          fill="#A1007E"
          stroke="white"
          strokeWidth="0.5"
        />
        <path
          opacity="0.6"
          d="M34.6667 15.7014L19.5555 14.2061L35.2592 16.7481L51.7037 24.8229V22.5799L34.6667 15.7014Z"
          fill="#FF09EF"
          stroke="white"
          strokeWidth="0.5"
        />
        <path
          opacity="0.6"
          d="M34.0741 14.6545L19.7037 14.3555L34.6667 15.5517L51.7037 22.4302V20.3368L34.0741 14.6545Z"
          fill="#0D4AE3"
          stroke="white"
          strokeWidth="0.5"
        />
        <path
          opacity="0.6"
          d="M33.4815 13.458L19.5555 14.3552L33.9259 14.5047L51.7037 20.187V18.2431L33.4815 13.458Z"
          fill="#17C408"
          stroke="white"
          strokeWidth="0.5"
        />
        <path
          opacity="0.6"
          d="M32.1481 11.0654L19.5555 14.3551L32.7407 12.2617L51.7037 15.8505V13.6075L32.1481 11.0654Z"
          fill="#FF9D00"
          stroke="white"
          strokeWidth="0.5"
        />
        <path
          opacity="0.6"
          d="M31.4074 9.86914L19.5555 14.3551L32.1481 11.0654L51.7037 13.4579V11.2149L31.4074 9.86914Z"
          fill="#FF0000"
          stroke="white"
          strokeWidth="0.5"
        />
        <path
          opacity="0.6"
          d="M32.7408 12.2617L19.7037 14.3552L33.4815 13.3084L51.7037 18.0935V16L32.7408 12.2617Z"
          fill="#FFFF00"
          stroke="white"
          strokeWidth="0.5"
        />
        <path
          d="M18.997 14.4219L2.40442 23.0948"
          stroke="#C4C4C4"
          strokeWidth="0.5"
        />
        <path
          d="M18.9979 14.7202L2.40527 23.6922"
          stroke="#C4C4C4"
          strokeWidth="0.5"
        />
      </g>
      <defs>
        <linearGradient
          id="paint0_mono"
          x1="26.963"
          y1="7.92544"
          x2="26.963"
          y2="30.8039"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" />
          <stop offset="1" stopColor="#9CF0FF" />
        </linearGradient>
      </defs>
    </svg>
  )
};

export { scatteringIcons };

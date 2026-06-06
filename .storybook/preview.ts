import type { Preview } from "@storybook/react-vite";

import "../src/styles.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "error",
      options: {
        rules: {
          "color-contrast": {
            enabled: true,
          },
        },
      },
    },
  },
};

export default preview;

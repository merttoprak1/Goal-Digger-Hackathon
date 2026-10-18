/**
 * Build-level feature switches.
 *
 * Challenge creation and the Goaly chat both depend on the local model and
 * services described in the download instructions. They stay disabled until
 * that setup is complete. Flip a flag to `true` to re-enable the matching
 * affordances.
 */
export const CHALLENGE_CREATION_ENABLED = false;

export const GOALY_CHAT_ENABLED = false;

/** Shared wording for every “not set up yet” notice and disabled control. */
export const DOWNLOAD_INSTRUCTIONS_HINT =
  "Follow the download instructions first to install the local model and services, then restart the app.";

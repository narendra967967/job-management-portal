// R1.2 to R1.3: the Mock interviews screens run on sample data. They show only on
// a developer machine; production keeps the Coming soon pages, so deploying
// narendra in the meantime never exposes sample screens. R1.4 replaces this with
// the admin Open / Coming soon switches.

export const SHOW_SAMPLE_SCREENS = process.env.NODE_ENV !== "production";

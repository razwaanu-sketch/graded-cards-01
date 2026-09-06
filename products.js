// Product catalog for Graded Cards 01.
//
// To edit prices: change the `price` number below and push.
// To mark a card sold: set `sold: true`.
// To add a Stripe "Buy Now" link: see SETUP.md, then paste the URL into `stripeLink`.
// To add real photos: upload files to images/cards/ using the exact `image` filename below.
// `tags` controls which category tiles / filter chips a card shows under on the shop page.
const PRODUCTS = [
  {
    id: "eevee-ex",
    name: "Eevee ex",
    set: "2024 Pokémon SV8a (Japanese) — Special Art Rare",
    cardNumber: "224/187",
    grade: "PSA 10",
    gradeLabel: "GEM MT",
    certNumber: "126888621",
    price: 300,
    currency: "GBP",
    image: "images/cards/eevee-ex.jpg",
    stripeLink: "https://buy.stripe.com/fZucN52VR7FzeiP6CL0oM01",
    sold: false,
    tags: ["eeveelution"]
  },
  {
    id: "flareon-ex",
    name: "Flareon ex",
    set: "2024 Pokémon SV8a (Japanese) — Special Art Rare",
    cardNumber: "202/187",
    grade: "PSA 10",
    gradeLabel: "GEM MT",
    certNumber: "125259169",
    price: 300,
    currency: "GBP",
    image: "images/cards/flareon-ex.jpg",
    stripeLink: "https://buy.stripe.com/3cI14n683cZT7Ure5d0oM02",
    sold: false,
    tags: ["eeveelution"]
  },
  {
    id: "espeon-ex",
    name: "Espeon ex",
    set: "2024 Pokémon SV8a (Japanese) — Special Art Rare",
    cardNumber: "211/187",
    grade: "PSA 10",
    gradeLabel: "GEM MT",
    certNumber: "119293280",
    price: 300,
    currency: "GBP",
    image: "images/cards/espeon-ex.jpg",
    stripeLink: "https://buy.stripe.com/dRm28rbsn8JDa2z9OX0oM03",
    sold: false,
    tags: ["eeveelution"]
  },
  {
    id: "leafeon-ex",
    name: "Leafeon ex",
    set: "2024 Pokémon SV8a (Japanese) — Special Art Rare",
    cardNumber: "200/187",
    grade: "PSA 10",
    gradeLabel: "GEM MT",
    certNumber: "110913767",
    price: 300,
    currency: "GBP",
    image: "images/cards/leafeon-ex.jpg",
    stripeLink: "https://buy.stripe.com/aFa9ATeEzf81fmT9OX0oM04",
    sold: false,
    tags: ["eeveelution"]
  },
  {
    id: "jolteon-ex",
    name: "Jolteon ex",
    set: "2024 Pokémon SV8a (Japanese) — Special Art Rare",
    cardNumber: "209/187",
    grade: "PSA 10",
    gradeLabel: "GEM MT",
    certNumber: "139522269",
    price: 300,
    currency: "GBP",
    image: "images/cards/jolteon-ex.jpg",
    stripeLink: "https://buy.stripe.com/6oUeVdcwr4tn7Ur0en0oM05",
    sold: false,
    tags: ["eeveelution"]
  },
  {
    id: "mega-gengar-ex",
    name: "Mega Gengar ex",
    set: "2025 Pokémon Mega Dream EX (Japanese) — Special Art Rare",
    cardNumber: "240/193",
    grade: "PSA 10",
    gradeLabel: "GEM MT",
    certNumber: "712301",
    price: 900,
    currency: "GBP",
    image: "images/cards/mega-gengar-ex.jpg",
    stripeLink: "https://buy.stripe.com/cNi7sLgMH1hb4Iff9h0oM06",
    sold: false,
    tags: ["mega-evolution"]
  },
  {
    id: "mega-venusaur-ex",
    name: "Mega Venusaur ex",
    set: "2025 Pokémon M1L (Japanese) — Special Art Rare",
    cardNumber: "087/063",
    grade: "PSA 10",
    gradeLabel: "GEM MT",
    certNumber: "135913105",
    price: 300,
    currency: "GBP",
    image: "images/cards/mega-venusaur-ex.jpg",
    stripeLink: "https://buy.stripe.com/9B67sL2VR6BveiP0en0oM07",
    sold: false,
    tags: ["mega-evolution"]
  },
  {
    id: "bulbasaur",
    name: "Bulbasaur",
    set: "2025 Pokémon M1L (Japanese) — Art Rare",
    cardNumber: "064/063",
    grade: "PSA 10",
    gradeLabel: "GEM MT",
    certNumber: "135913178",
    price: 300,
    currency: "GBP",
    image: "images/cards/bulbasaur.jpg",
    stripeLink: "https://buy.stripe.com/7sYdR9cwr1hb1w3d190oM08",
    sold: false,
    tags: ["other"]
  },
  {
    id: "articuno",
    name: "Articuno",
    set: "2025 Pokémon SV9 (Japanese) — Art Rare",
    cardNumber: "102/100",
    grade: "PSA 10",
    gradeLabel: "GEM MT",
    certNumber: "135913325",
    price: 300,
    currency: "GBP",
    image: "images/cards/articuno.jpg",
    stripeLink: "https://buy.stripe.com/3cI00j6837FzgqXe5d0oM0a",
    sold: false,
    tags: ["other"]
  },
  {
    id: "pikachu-ex",
    name: "Pikachu ex",
    set: "2024 Pokémon SV8 (Japanese) — Special Art Rare",
    cardNumber: "132/106",
    grade: "PSA 10",
    gradeLabel: "GEM MT",
    certNumber: "101087792",
    price: 1000,
    currency: "GBP",
    image: "images/cards/pikachu-ex.jpg",
    stripeLink: "https://buy.stripe.com/5kQeVdcwr8JD2A75yH0oM0b",
    sold: false,
    tags: ["other"]
  }
];

// Category tiles shown above the shop grid. `tag` must match a value in each
// product's `tags` array above (or "" for "all cards").
const CATEGORIES = [
  { tag: "", label: "All Cards", sub: "The full collection", image: "images/cards/eevee-ex.jpg" },
  { tag: "eeveelution", label: "Eeveelutions", sub: "5 cards", image: "images/cards/eevee-ex.jpg" },
  { tag: "mega-evolution", label: "Mega Evolutions", sub: "2 cards", image: "images/cards/mega-gengar-ex.jpg" },
  { tag: "other", label: "Other Singles", sub: "3 cards", image: "images/cards/pikachu-ex.jpg" }
];

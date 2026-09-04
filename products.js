// Product catalog for Elite PSA Graded Pokémon Cards.
//
// To edit prices: change the `price` number below and push.
// To mark a card sold: set `sold: true`.
// To add a Stripe "Buy Now" link: see SETUP.md, then paste the URL into `stripeLink`.
// To add real photos: upload files to images/cards/ using the exact `image` filename below.
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
    stripeLink: "",
    sold: false
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
    stripeLink: "",
    sold: false
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
    stripeLink: "",
    sold: false
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
    stripeLink: "",
    sold: false
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
    stripeLink: "",
    sold: false
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
    stripeLink: "",
    sold: false
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
    stripeLink: "",
    sold: false
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
    stripeLink: "",
    sold: false
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
    stripeLink: "",
    sold: false
  },
  {
    id: "pikachu-ex",
    name: "Pikachu ex",
    set: "2024 Pokémon SV8 (Japanese) — Special Art Rare",
    cardNumber: "132/106",
    grade: "PSA 10",
    gradeLabel: "GEM MT",
    certNumber: "101087792",
    price: 300,
    currency: "GBP",
    image: "images/cards/pikachu-ex.jpg",
    stripeLink: "",
    sold: false
  }
];

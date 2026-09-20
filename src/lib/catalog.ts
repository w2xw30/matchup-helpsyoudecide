export type ItemKind = "food" | "drink" | "dessert" | "movie" | "game" | "activity" | "place" | "other";
export type LobbyKind = ItemKind | "mixed";

export const KIND_META: Record<ItemKind, { label: string; emoji: string; from: string; to: string }> = {
  food: { label: "Food", emoji: "🍽️", from: "#fde6e8", to: "#fbd0d5" },
  drink: { label: "Drinks", emoji: "🥤", from: "#e3f3fb", to: "#c9e6f6" },
  dessert: { label: "Dessert", emoji: "🍨", from: "#fdeaf3", to: "#f9cfe3" },
  movie: { label: "Movies", emoji: "🎬", from: "#fbf3d0", to: "#f5e69b" },
  game: { label: "Games", emoji: "🎮", from: "#e9e2f5", to: "#d5c8ec" },
  activity: { label: "Activities", emoji: "🥾", from: "#e0f3e6", to: "#c3e6cf" },
  place: { label: "Places", emoji: "📍", from: "#e7ecfb", to: "#cdd7f6" },
  other: { label: "Ideas", emoji: "✨", from: "#f1ecf7", to: "#e2d9ee" },
};

export const LOBBY_KINDS: { id: LobbyKind; label: string; emoji: string; blurb: string }[] = [
  { id: "food", label: "Food", emoji: "🍕", blurb: "Where & what to eat" },
  { id: "movie", label: "Movies", emoji: "🎬", blurb: "Pick the watch" },
  { id: "game", label: "Games", emoji: "🎮", blurb: "Board, video, party" },
  { id: "activity", label: "Activities", emoji: "🥾", blurb: "Things to do" },
  { id: "mixed", label: "Anything", emoji: "✨", blurb: "Mix it up" },
];

/** [keywords, emoji, kind] — first match wins, so put specific words first. */
const RAW: [string, string, ItemKind][] = [
  // games
  ["catan monopoly risk scrabble boardgame board game", "🎲", "game"],
  ["chess", "♟️", "game"],
  ["poker uno cards card game blackjack", "🃏", "game"],
  ["mario kart racing", "🏎️", "game"],
  ["smash zelda nintendo switch fortnite minecraft valorant xbox playstation ps5 pc gaming among us overcooked video game videogame", "🎮", "game"],
  ["arcade pinball", "🕹️", "game"],
  ["bowling", "🎳", "game"],
  ["pool billiards snooker", "🎱", "game"],
  ["darts", "🎯", "game"],
  ["escape room", "🔐", "game"],
  ["trivia quiz", "❓", "game"],
  ["karaoke", "🎤", "activity"],
  ["puzzle jigsaw", "🧩", "game"],
  ["charades", "🎭", "game"],
  // movies / shows
  ["popcorn", "🍿", "movie"],
  ["horror scary", "👻", "movie"],
  ["comedy stand-up standup", "😂", "movie"],
  ["interstellar space sci-fi scifi dune star wars alien", "🚀", "movie"],
  ["marvel avengers superhero batman spiderman", "🦸", "movie"],
  ["anime ghibli spirited", "🎌", "movie"],
  ["disney pixar animation animated", "🏰", "movie"],
  ["romance rom-com", "💕", "movie"],
  ["documentary", "🎞️", "movie"],
  ["series netflix show tv binge", "📺", "movie"],
  ["movie film cinema marathon", "🎬", "movie"],
  // food
  ["pizza", "🍕", "food"],
  ["pasta spaghetti lasagna macaroni penne", "🍝", "food"],
  ["sushi sashimi", "🍣", "food"],
  ["ramen noodle noodles pho udon", "🍜", "food"],
  ["burger hamburger", "🍔", "food"],
  ["taco", "🌮", "food"],
  ["burrito", "🌯", "food"],
  ["momo dumpling dumplings gyoza dimsum dim sum", "🥟", "food"],
  ["salad vegan vegetarian", "🥗", "food"],
  ["steak", "🥩", "food"],
  ["chicken wings", "🍗", "food"],
  ["fries chips", "🍟", "food"],
  ["hotdog hot dog", "🌭", "food"],
  ["sandwich sub panini", "🥪", "food"],
  ["curry biryani masala", "🍛", "food"],
  ["rice bowl fried rice", "🍚", "food"],
  ["bbq barbecue grill ribs", "🍖", "food"],
  ["shrimp prawn seafood lobster", "🍤", "food"],
  ["bread baguette bakery", "🥖", "food"],
  ["pancake waffle brunch", "🥞", "food"],
  ["breakfast egg omelette", "🍳", "food"],
  ["soup stew hotpot hot pot", "🍲", "food"],
  ["bento thali", "🍱", "food"],
  ["kebab shawarma gyro wrap", "🥙", "food"],
  ["falafel hummus", "🧆", "food"],
  ["cheese fondue", "🧀", "food"],
  ["tapas", "🫒", "food"],
  ["food dinner lunch restaurant", "🍽️", "food"],
  // dessert
  ["gelato ice cream icecream sundae", "🍨", "dessert"],
  ["donut doughnut", "🍩", "dessert"],
  ["cupcake", "🧁", "dessert"],
  ["cake tiramisu cheesecake", "🍰", "dessert"],
  ["chocolate brownie", "🍫", "dessert"],
  ["cookie biscuit", "🍪", "dessert"],
  ["pie", "🥧", "dessert"],
  ["pudding custard flan", "🍮", "dessert"],
  ["dessert sweet", "🍬", "dessert"],
  // drinks
  ["boba bubble tea", "🧋", "drink"],
  ["coffee cafe latte espresso", "☕", "drink"],
  ["tea chai matcha", "🍵", "drink"],
  ["beer brewery pub", "🍺", "drink"],
  ["wine winery vineyard", "🍷", "drink"],
  ["cocktail mocktail margarita", "🍸", "drink"],
  ["whiskey whisky bourbon", "🥃", "drink"],
  ["sake soju", "🍶", "drink"],
  ["juice smoothie", "🧃", "drink"],
  ["drinks bar", "🍻", "drink"],
  // activities
  ["hike hiking trek trekking trail", "🥾", "activity"],
  ["camp camping tent", "⛺", "activity"],
  ["picnic", "🧺", "activity"],
  ["beach", "🏖️", "activity"],
  ["swim swimming pool party", "🏊", "activity"],
  ["bike cycling cycle", "🚴", "activity"],
  ["run running marathon jog", "🏃", "activity"],
  ["gym workout fitness", "🏋️", "activity"],
  ["yoga meditation", "🧘", "activity"],
  ["soccer football futsal", "⚽", "activity"],
  ["basketball", "🏀", "activity"],
  ["tennis", "🎾", "activity"],
  ["cricket", "🏏", "activity"],
  ["badminton", "🏸", "activity"],
  ["volleyball", "🏐", "activity"],
  ["skating ice skating", "⛸️", "activity"],
  ["ski skiing snowboard", "⛷️", "activity"],
  ["kayak canoe boat rafting", "🛶", "activity"],
  ["fishing", "🎣", "activity"],
  ["road trip drive", "🚗", "activity"],
  ["museum gallery exhibition", "🏛️", "place"],
  ["zoo safari", "🦁", "place"],
  ["park garden", "🌳", "place"],
  ["concert live music gig festival band", "🎵", "activity"],
  ["dance club nightclub party", "💃", "activity"],
  ["shopping mall", "🛍️", "activity"],
  ["spa massage", "💆", "activity"],
  ["art painting craft pottery", "🎨", "activity"],
  ["photo photography photoshoot", "📸", "activity"],
  ["bonfire campfire", "🔥", "activity"],
  ["stargazing stars", "🔭", "activity"],
  ["theatre theater play musical", "🎭", "activity"],
  ["library book books reading", "📚", "activity"],
  ["temple church", "⛩️", "place"],
  ["hotel resort", "🏨", "place"],
  ["cafe", "☕", "place"],
];

interface Entry {
  words: string[];
  emoji: string;
  kind: ItemKind;
}
const CATALOG: Entry[] = RAW.map(([kw, emoji, kind]) => ({ words: kw.split(" "), emoji, kind }));

export interface Visual {
  emoji: string;
  kind: ItemKind;
  matched: boolean;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\- ]/g, " ");

/** Cheap, offline "what does this look like" guess used for emoji + category. */
export function guessVisual(text: string, fallbackKind?: ItemKind): Visual {
  const t = ` ${norm(text)} `;
  const tokens = t.trim().split(/\s+/);
  for (const e of CATALOG) {
    for (const w of e.words) {
      if (tokens.includes(w) || (w.length >= 5 && tokens.some((tok) => tok.startsWith(w) || (tok.length >= 5 && w.startsWith(tok))))) {
        return { emoji: e.emoji, kind: e.kind, matched: true };
      }
    }
    // multi-word keys such as "ice cream"
    const phrase = e.words.join(" ");
    if (e.words.length > 1 && t.includes(` ${phrase} `)) return { emoji: e.emoji, kind: e.kind, matched: true };
  }
  const kind = fallbackKind ?? "other";
  return { emoji: KIND_META[kind].emoji, kind, matched: false };
}

/** Popular starting points per lobby type — shown as one-tap suggestions. */
export const POPULAR: Record<LobbyKind, string[]> = {
  food: ["Pizza", "Sushi", "Burgers", "Momo", "Ramen", "Tacos", "Pasta", "Fried Chicken", "Thai Curry", "BBQ"],
  drink: ["Bubble Tea", "Coffee", "Craft Beer", "Cocktails", "Smoothies"],
  dessert: ["Ice Cream", "Cheesecake", "Donuts", "Brownies"],
  movie: ["Interstellar", "Spirited Away", "The Dark Knight", "Parasite", "Inception", "Coco", "Knives Out"],
  game: ["Catan", "Uno", "Mario Kart", "Codenames", "Charades", "Pool", "Bowling", "Escape Room"],
  activity: ["Hiking", "Bowling", "Karaoke", "Picnic", "Beach Day", "Board Game Cafe", "Bonfire", "Museum"],
  place: ["Rooftop Cafe", "City Park", "Night Market", "Art Museum"],
  other: ["Movie Night", "Game Night", "Potluck Dinner"],
  mixed: ["Pizza", "Movie Night", "Bowling", "Karaoke", "Hiking", "Board Games", "Ice Cream", "Picnic"],
};

export const wordsByDifficulty = {
  easy: [
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "I",
    "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
    "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
    "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
    "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
    "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
    "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
    "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
    "back", "after", "use", "two", "how", "our", "work", "first", "well", "way",
    "even", "new", "want", "because", "any", "these", "give", "day", "most", "us",
    "is", "are", "was", "were", "been", "has", "had", "may", "did", "said",
    "each", "she", "many", "find", "here", "must", "between", "both", "few", "those",
    "own", "same", "tell", "help", "every", "world", "home", "still", "high", "last",
    "might", "while", "should", "large", "start", "feel", "need", "turn", "ask", "show"
  ],
  medium: [
    "different", "important", "another", "following", "around", "develop", "under", "number", "however", "against",
    "possible", "government", "company", "system", "program", "question", "during", "business", "without", "through",
    "problem", "change", "example", "include", "believe", "country", "always", "provide", "should", "service",
    "information", "experience", "development", "market", "support", "available", "national", "social", "political", "economic",
    "industry", "project", "process", "research", "community", "technology", "interest", "continue", "position", "education",
    "special", "general", "central", "international", "financial", "personal", "significant", "particular", "different", "individual",
    "current", "previous", "similar", "various", "particular", "according", "although", "whether", "consider", "determine",
    "establish", "describe", "identify", "produce", "require", "represent", "include", "suggest", "involve", "approach",
    "maintain", "increase", "improve", "achieve", "receive", "recognize", "discuss", "present", "remember", "understand",
    "decision", "situation", "management", "performance", "environment", "opportunity", "relationship", "organization", "responsibility", "administration"
  ],
  hard: [
    "extraordinary", "sophisticated", "comprehensive", "approximately", "circumstances", "accomplishment", "infrastructure", "acknowledgement", "characteristic", "entrepreneurship",
    "miscellaneous", "spontaneous", "consciousness", "pronunciation", "questionnaire", "rehabilitation", "pharmaceutical", "Mediterranean", "simultaneously", "authentication",
    "photosynthesis", "philosophical", "psychological", "archaeological", "constitutional", "congratulations", "recommendation", "correspondence", "representative", "telecommunications",
    "enthusiastically", "disproportionate", "indistinguishable", "uncharacteristically", "counterproductive", "multidimensional", "interconnectedness", "overwhelmingly", "extraordinarily", "disproportionately",
    "implementation", "differentiation", "transformation", "visualization", "collaboration", "specification", "interpretation", "communication", "professionalism", "responsibility",
    "accountability", "sustainability", "infrastructure", "configuration", "administration", "demonstration", "documentation", "experimentation", "industrialization", "internationalization",
    "catastrophic", "paradoxical", "hypothetical", "metaphorical", "symmetrical", "bureaucratic", "aristocratic", "geographical", "biographical", "mathematical",
    "consequently", "predominantly", "substantially", "fundamentally", "significantly", "approximately", "independently", "systematically", "enthusiastically", "professionally",
    "unconventional", "unprecedented", "unforeseeable", "unquestionable", "indispensable", "insurmountable", "incomprehensible", "inconsequential", "interchangeable", "interdisciplinary",
    "reconciliation", "discrimination", "generalization", "specialization", "standardization", "synchronization", "marginalization", "decentralization", "commercialization", "industrialization"
  ]
};

export const quotes = [
  {
    text: "The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle.",
    author: "Steve Jobs",
    difficulty: "easy"
  },
  {
    text: "In the middle of difficulty lies opportunity. Life is what happens to you while you're busy making other plans.",
    author: "Albert Einstein",
    difficulty: "easy"
  },
  {
    text: "Success is not final, failure is not fatal: it is the courage to continue that counts. Never give in.",
    author: "Winston Churchill",
    difficulty: "easy"
  },
  {
    text: "The future belongs to those who believe in the beauty of their dreams. With self-discipline most anything is possible.",
    author: "Eleanor Roosevelt",
    difficulty: "medium"
  },
  {
    text: "It is not the strongest of the species that survives, nor the most intelligent, but the one most responsive to change.",
    author: "Charles Darwin",
    difficulty: "medium"
  },
  {
    text: "Two things are infinite: the universe and human stupidity; and I'm not sure about the universe. Imagination is more important than knowledge.",
    author: "Albert Einstein",
    difficulty: "medium"
  },
  {
    text: "The greatest glory in living lies not in never falling, but in rising every time we fall. Spread love everywhere you go.",
    author: "Nelson Mandela",
    difficulty: "hard"
  },
  {
    text: "You have brains in your head. You have feet in your shoes. You can steer yourself any direction you choose. You're on your own and you know what you know.",
    author: "Dr. Seuss",
    difficulty: "hard"
  },
  {
    text: "The only thing we have to fear is fear itself. Ask not what your country can do for you, ask what you can do for your country.",
    author: "Franklin D. Roosevelt",
    difficulty: "hard"
  }
];

export function getRandomWords(count: number, difficulty: "easy" | "medium" | "hard" = "easy"): string[] {
  const wordList = wordsByDifficulty[difficulty];
  const shuffled = [...wordList].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function getRandomQuote(difficulty?: "easy" | "medium" | "hard") {
  const filtered = difficulty ? quotes.filter(q => q.difficulty === difficulty) : quotes;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

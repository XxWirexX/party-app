-- Zeste : schéma initial.

CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  token_hash  text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Codes à usage unique pour ouvrir son compte sur un autre appareil.
CREATE TABLE login_codes (
  code_hash   text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL
);

CREATE TABLE parties (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  date          date NOT NULL,
  time          text NOT NULL DEFAULT '21:00',
  place         text NOT NULL DEFAULT '',
  theme         text NOT NULL DEFAULT 'dance',
  expected      int  NOT NULL DEFAULT 10 CHECK (expected BETWEEN 1 AND 500),
  invite_code   text NOT NULL UNIQUE,
  -- Rôle donné à ceux qui rejoignent par le lien : 'editor' (participe) ou 'viewer' (suit).
  default_role  text NOT NULL DEFAULT 'editor' CHECK (default_role IN ('editor', 'viewer')),
  -- Carte du soir : clés de cocktails (identifiant intégré ou uuid d'un cocktail maison).
  menu          jsonb NOT NULL DEFAULT '[]',
  created_by    uuid REFERENCES users ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Un membre est une personne sur la liste. user_id NULL = pas (encore) sur l'appli.
CREATE TABLE members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id    uuid NOT NULL REFERENCES parties ON DELETE CASCADE,
  user_id     uuid REFERENCES users ON DELETE SET NULL,
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  role        text NOT NULL DEFAULT 'viewer' CHECK (role IN ('host', 'editor', 'viewer')),
  status      text NOT NULL DEFAULT 'wait' CHECK (status IN ('wait', 'yes', 'maybe', 'no')),
  plus        int  NOT NULL DEFAULT 0 CHECK (plus BETWEEN 0 AND 9),
  brings      text NOT NULL DEFAULT '',
  in_split    boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (party_id, user_id)
);
CREATE INDEX members_user ON members (user_id);

CREATE TABLE items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id     uuid NOT NULL REFERENCES parties ON DELETE CASCADE,
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  qty          numeric(10,2) NOT NULL DEFAULT 1,
  unit         text NOT NULL DEFAULT '',
  cat          text NOT NULL DEFAULT 'divers',
  price        numeric(10,2) NOT NULL DEFAULT 0,      -- prix estimé à l'unité
  note         text NOT NULL DEFAULT '',              -- ex. « Mojito × 6 »
  assignee     uuid REFERENCES members ON DELETE SET NULL,
  bought       boolean NOT NULL DEFAULT false,
  level        smallint CHECK (level BETWEEN 0 AND 3), -- stock restant
  paid_by      uuid REFERENCES members ON DELETE SET NULL,
  paid_amount  numeric(10,2),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX items_party ON items (party_id);

-- Dépenses hors liste de courses (taxi, location d'enceinte…).
CREATE TABLE expenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id    uuid NOT NULL REFERENCES parties ON DELETE CASCADE,
  label       text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 60),
  amount      numeric(10,2) NOT NULL CHECK (amount >= 0),
  paid_by     uuid NOT NULL REFERENCES members ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expenses_party ON expenses (party_id);

-- Remboursements déjà faits entre deux membres.
CREATE TABLE transfers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id     uuid NOT NULL REFERENCES parties ON DELETE CASCADE,
  from_member  uuid NOT NULL REFERENCES members ON DELETE CASCADE,
  to_member    uuid NOT NULL REFERENCES members ON DELETE CASCADE,
  amount       numeric(10,2) NOT NULL CHECK (amount > 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transfers_party ON transfers (party_id);

CREATE TABLE tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id    uuid NOT NULL REFERENCES parties ON DELETE CASCADE,
  label       text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  when_label  text NOT NULL DEFAULT '',
  done        boolean NOT NULL DEFAULT false,
  position    int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_party ON tasks (party_id);

-- Cocktails maison, propres à une soirée.
CREATE TABLE cocktails (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id     uuid NOT NULL REFERENCES parties ON DELETE CASCADE,
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  glass        text NOT NULL DEFAULT 'highball',
  color        text NOT NULL DEFAULT '#FF9248',
  strength     smallint NOT NULL DEFAULT 2 CHECK (strength BETWEEN 0 AND 3),
  batch        int NOT NULL DEFAULT 1 CHECK (batch BETWEEN 1 AND 50),
  ingredients  jsonb NOT NULL DEFAULT '[]',
  steps        jsonb NOT NULL DEFAULT '[]',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cocktails_party ON cocktails (party_id);

CREATE TABLE photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id    uuid NOT NULL REFERENCES parties ON DELETE CASCADE,
  member_id   uuid REFERENCES members ON DELETE SET NULL,
  mime        text NOT NULL,
  data        bytea NOT NULL,
  w           int NOT NULL DEFAULT 4,
  h           int NOT NULL DEFAULT 3,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX photos_party ON photos (party_id);

CREATE TABLE photo_likes (
  photo_id   uuid NOT NULL REFERENCES photos ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES members ON DELETE CASCADE,
  PRIMARY KEY (photo_id, member_id)
);

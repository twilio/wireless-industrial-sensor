
CREATE TABLE devices (
  id INTEGER primary key autoincrement,
  name TEXT,
  twilio_sid TEXT,
  address_line TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  token TEXT,
  created_at TIMESTAMP
);

CREATE TABLE bean_data (
  id integer primary key autoincrement,
  device_id INTEGER,
  weight NUMERIC,
  temp NUMERIC,
  humidity NUMERIC,
  created_at TIMESTAMP,
  FOREIGN KEY(device_id) REFERENCES devices(id)
);
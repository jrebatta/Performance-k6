const NAMES = ['Ana', 'Carlos', 'Maria', 'Juan', 'Sofia', 'Pedro', 'Laura', 'Diego', 'Lucia', 'Miguel'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomString(length = 8) {
  return Math.random().toString(36).slice(2, 2 + length);
}

export function randomName() {
  return `${randomItem(NAMES)} ${randomItem(NAMES)}`;
}

export function randomEmail() {
  return `${randomString()}_vu${__VU}_${Date.now()}@qa.com`;
}

export function randomPassword() {
  return randomString(12);
}

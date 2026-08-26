import { DEMO_PETS } from "./data.js";

const PUBLICATIONS_KEY = "five-dogs-publications-v1";
const SIGHTINGS_KEY = "five-dogs-sightings-v1";

function safeRead(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.warn(`No se pudo leer ${key}; se usará una lista vacía.`, error);
    return [];
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("five-dogs-storage-updated", { detail: { key } }));
}

function makeId(prefix) {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8).toUpperCase()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  return `${prefix}-${randomPart}`;
}

export function getUserPublications() {
  return safeRead(PUBLICATIONS_KEY);
}

export function getSightings() {
  return safeRead(SIGHTINGS_KEY);
}

export function getAllPets() {
  return [...getUserPublications(), ...DEMO_PETS];
}

export function getPetById(id) {
  return getAllPets().find((pet) => pet.id === id);
}

export function savePublication(values) {
  const publication = {
    ...values,
    id: makeId("FD"),
    isUserCreated: true,
    createdAt: new Date().toISOString(),
  };
  write(PUBLICATIONS_KEY, [publication, ...getUserPublications()]);
  return publication;
}

export function markPublicationReunited(id) {
  const updated = getUserPublications().map((pet) =>
    pet.id === id ? { ...pet, status: "Reunido", updatedAt: new Date().toISOString() } : pet,
  );
  write(PUBLICATIONS_KEY, updated);
  return updated.find((pet) => pet.id === id);
}

export function deletePublication(id) {
  write(
    PUBLICATIONS_KEY,
    getUserPublications().filter((pet) => pet.id !== id),
  );
}

export function saveSighting(values) {
  const sighting = {
    ...values,
    id: makeId("AV"),
    createdAt: new Date().toISOString(),
  };
  write(SIGHTINGS_KEY, [sighting, ...getSightings()]);
  return sighting;
}

export function deleteSighting(id) {
  write(
    SIGHTINGS_KEY,
    getSightings().filter((report) => report.id !== id),
  );
}

export function clearFiveDogsDemoData() {
  localStorage.removeItem(PUBLICATIONS_KEY);
  localStorage.removeItem(SIGHTINGS_KEY);
  window.dispatchEvent(new CustomEvent("five-dogs-storage-updated"));
}

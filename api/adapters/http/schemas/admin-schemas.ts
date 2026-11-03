import Joi from "joi";
import { Artist } from "../../../domain/entities/artist.ts";
import { Music } from "../../../domain/entities/music.ts";
import { birthdateSchema, EMAIL_MAX_LENGTH, NAME_MAX_LENGTH } from "../../auth/create-auth.ts";

const ids = Joi.array().items(Joi.number().integer().positive());

export const createUserSchema = Joi.object({
  name: Joi.string().trim().min(1).max(NAME_MAX_LENGTH).required(),
  // Sem lista de TLDs, como o cadastro do Better Auth (aceita domínios como .test do seed).
  email: Joi.string().trim().email({ tlds: { allow: false } }).max(EMAIL_MAX_LENGTH).required(),
  // Os mesmos limites do cadastro (create-auth.ts).
  password: Joi.string().min(8).max(128).required(),
  birthdate: birthdateSchema.required(),
  role: Joi.string().valid("admin", "assinante").default("assinante"),
});

export const createMusicSchema = Joi.object({
  name: Joi.string().trim().min(1).max(Music.MAX_NAME_LENGTH).required(),
  duration: Joi.number().integer().positive().required(),
  artistIds: ids.min(1).required(),
  genreIds: ids.default([]),
});

export const updateMusicSchema = Joi.object({
  name: Joi.string().trim().min(1).max(Music.MAX_NAME_LENGTH),
  duration: Joi.number().integer().positive(),
  artistIds: ids.min(1),
  genreIds: ids,
}).min(1);

export const artistSchema = Joi.object({
  name: Joi.string().trim().min(1).max(Artist.MAX_NAME_LENGTH).required(),
});

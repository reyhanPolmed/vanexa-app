-- array_length/array_ndims return NULL for an empty array; CHECK accepts NULL.
-- Cardinality guards ensure even direct database writes cannot store zero options.
ALTER TABLE bank_questions ADD CONSTRAINT bank_question_option_count CHECK (cardinality(options) = 5);
ALTER TABLE bank_questions ADD CONSTRAINT bank_question_weight_count CHECK (weights IS NULL OR cardinality(weights) = 5);

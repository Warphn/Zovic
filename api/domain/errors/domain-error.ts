export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  readonly code = "VALIDATION_ERROR";
}

export class BusinessRuleError extends DomainError {
  readonly code = "BUSINESS_RULE_ERROR";
}
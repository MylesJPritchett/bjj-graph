// Video times are kept to the hundredth of a second.

/** `seconds` rounded to the nearest hundredth. */
export const toHundredths = (seconds: number): number => Math.round(seconds * 100) / 100;

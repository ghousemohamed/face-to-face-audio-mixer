export class Resampler {
  constructor(inputRate, outputRate) {
    this.ratio = inputRate / outputRate;
    this.previous = 0;

    this.position = 1;
  }

  process(input) {
    if (this.ratio === 1 || input.length === 0) return input;

    const lastIndex = input.length;
    const at = (index) => (index === 0 ? this.previous : input[index - 1]);

    const output = new Float32Array(Math.ceil(lastIndex / this.ratio) + 2);
    let written = 0;
    let position = this.position;

    while (Math.floor(position) + 1 <= lastIndex) {
      const index = Math.floor(position);
      const fraction = position - index;

      output[written] = at(index) * (1 - fraction) + at(index + 1) * fraction;
      written += 1;
      position += this.ratio;
    }

    this.previous = input[lastIndex - 1];
    this.position = position - lastIndex;

    return output.subarray(0, written);
  }
}

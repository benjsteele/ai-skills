// promptfoo provider that returns vars.answer instead of calling a model.
// Used by grader-check.yaml to feed known answers to the grader.
module.exports = class CannedAnswer {
  id() {
    return 'canned-answer';
  }
  async callApi(prompt, context) {
    return { output: context.vars.answer };
  }
};

import assert from "node:assert/strict";
import test from "node:test";
import { explainBestMatch } from "../src/order_search.js";

test("the strongest semantic match determines the customer guidance", () => {
  const answer = explainBestMatch([
    { id: "checkout", score: 0.61, metadata: { title: "Checkout payment", guidance: "Confirm payment." } },
    { id: "receipt", score: 0.92, metadata: { title: "Receipt copy", guidance: "Send the completed-order receipt." } },
  ]);

  assert.equal(answer, "Receipt copy: Send the completed-order receipt.");
});

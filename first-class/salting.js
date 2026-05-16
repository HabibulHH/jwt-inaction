const bcrypt = require("bcrypt");

async function test(rounds) {
  const start = Date.now();

  await bcrypt.hash("MyPassword123", rounds);

  console.log(rounds, Date.now() - start, "ms");
}

test(10);
test(12);
test(14);
test(20);

async function main() {
  const password = "123456";

  const hash = await bcrypt.hash(password, 10);

  console.log(hash);

  const isMatch = await bcrypt.compare("123456", hash);

  console.log(isMatch);
}

main();
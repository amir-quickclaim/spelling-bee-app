const defaultPasswords = {
  liam: "liam",
  parent: "parent"
};

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  return req.body;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { password } = parseBody(req);
    const liamPassword = process.env.LIAM_PASSWORD || defaultPasswords.liam;
    const parentPassword = process.env.PARENT_PASSWORD || defaultPasswords.parent;

    if (password === liamPassword) {
      return res.status(200).json({ role: "liam" });
    }

    if (password === parentPassword) {
      return res.status(200).json({ role: "parent" });
    }

    return res.status(401).json({ error: "Wrong password" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not log in" });
  }
}

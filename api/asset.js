const ASSETS = {
  pack: "https://cdn.3dassets.dev/assets/27595/v1/model.glb",
  ct:   "https://cdn.3dassets.dev/assets/27571/v1/model.glb",
  t:    "https://cdn.3dassets.dev/assets/27580/v1/model.glb"
};

module.exports = async (req, res) => {
  try {
    const name = String(req.query.name || "pack");
    const url = ASSETS[name];
    if (!url) {
      res.status(404).json({ error: "Unknown asset" });
      return;
    }
    const upstream = await fetch(url);
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: "Upstream asset failed" });
      return;
    }
    const data = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", "model/gltf-binary");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000");
    res.status(200).send(data);
  } catch (err) {
    res.status(500).json({ error: String(err && err.message || err) });
  }
};

import { Router } from "express";

import TemplateEngine from "./TemplateEngine";

const router = Router();

router.get("/", (req, res) => {
    const $title = req.query.title || "Default Title";
    TemplateEngine.sendView(res, "home", { $title, hello: "HELLO" });
});

export default router;

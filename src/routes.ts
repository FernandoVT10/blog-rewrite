import { Router } from "express";

import { sendView, compileView } from "./template";
import homeView from "./views/home";

const router = Router();

router.get("/", (_, res) => {
    sendView(res, homeView(["Hello", "Bye", "Bye2"]));
});

router.get("/test", async (req, res) => {
    const testView = await compileView();
    const $title = req.query.title || "Default Title";
    sendView(res, testView({ $title: $title }));
});

export default router;

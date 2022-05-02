// Import routes.
import "./poll";
import "./push";
import "./delete";

// Export the router.
import { router } from "./router";
export { router } from "./router";

// 404 for everything else.
router.all("*", () => new Response("Not Found.", { status: 404 }));

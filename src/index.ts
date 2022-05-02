// Load in the router.
import { router } from "./routes";
export default {
    fetch: router.handle,
};

// Export all durable objects.
export { Updates } from "./durable_objects/Updates";

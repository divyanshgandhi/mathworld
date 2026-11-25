import { Loading } from "@/components/kit/Empty";

/**
 * While a screen is on its way: the void and a slowly turning dashed orbit, centred, fixed to the
 * viewport so nothing jumps when the screen arrives. Words appear only if the wait runs long.
 */
export default function RouteLoading() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-void">
      <Loading />
    </div>
  );
}

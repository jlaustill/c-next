import type IHeaderServices from "../types/IHeaderServices";

/** 1.2's host services for a run with no C header: it runs no compiler */
const noHeaderServices: IHeaderServices = {
  preprocessorFor: () => {
    throw new Error("a run with no C header runs no compiler");
  },
  headerCache: null,
};

export default noHeaderServices;

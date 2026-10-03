import { describe, expect, it } from "vitest";
import { LINKS } from "./links";

const p = { origin: "LYS", destination: "BCN", out: "2026-11-14", ret: "2026-11-16", adults: 2 };

describe("liens pré-remplis", () => {
  it("Aviasales : codes et dates collés, marker optionnel", () => {
    expect(LINKS.aviasales(p)).toBe("https://www.aviasales.com/search/LYS1411BCN16112");
    expect(LINKS.aviasales({ ...p, marker: "123" })).toBe("https://www.aviasales.com/search/LYS1411BCN16112?marker=123");
  });
  it("Skyscanner : chemin en minuscules, dates AAMMJJ", () => {
    expect(LINKS.skyscanner(p)).toBe(
      "https://www.skyscanner.fr/transport/vols/lys/bcn/261114/261116/?adults=2&adultsv2=2&cabinclass=economy&rtn=1&preferdirects=false",
    );
  });
  it("Kayak et Google Flights", () => {
    expect(LINKS.kayak(p)).toBe("https://www.kayak.fr/flights/LYS-BCN/2026-11-14/2026-11-16/2adults?sort=bestflight_a");
    expect(LINKS.googleFlights(p)).toContain("Flights%20from%20LYS%20to%20BCN%20on%202026-11-14%20through%202026-11-16%20for%202%20adults");
  });
  it("SNCF Connect, BlaBlaCar, FlixBus, Rome2Rio", () => {
    expect(LINKS.sncfConnect("Lyon", "Barcelone", "2026-11-14")).toBe("https://www.sncf-connect.com/app/home/search?userInput=Lyon%20Barcelone%2014%2F11");
    expect(LINKS.blablacar("Lyon", "Barcelone", "2026-11-14", 2)).toBe("https://www.blablacar.fr/search?fn=Lyon&tn=Barcelone&db=2026-11-14&seats=2&search_origin=HOME");
    expect(LINKS.flixbus("Lyon", "Barcelona")).toBe("https://global.flixbus.com/bus-routes/bus-lyon-barcelona");
    expect(LINKS.rome2rio("Geneva", "Barcelona")).toBe("https://www.rome2rio.com/s/Geneva/Barcelona");
  });
  it("Google Maps et GetYourGuide", () => {
    expect(LINKS.maps("Park Güell", "Barcelone")).toBe("https://www.google.com/maps/search/?api=1&query=Park%20G%C3%BCell%20Barcelone");
    expect(LINKS.getYourGuide("Sagrada Família", "Barcelone")).toBe("https://www.getyourguide.fr/s/?q=Sagrada%20Fam%C3%ADlia%20Barcelone");
  });
  it("Booking et Airbnb", () => {
    expect(LINKS.booking("Barcelone", "2026-11-14", "2026-11-16", 3)).toContain("ss=Barcelone&checkin=2026-11-14&checkout=2026-11-16&group_adults=3&no_rooms=2");
    expect(LINKS.airbnb("Barcelone", "2026-11-14", "2026-11-16", 2)).toBe("https://www.airbnb.fr/s/Barcelone/homes?checkin=2026-11-14&checkout=2026-11-16&adults=2");
  });
});

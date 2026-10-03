import { describe, expect, it } from "vitest";
import { LINKS, googleFlightsTfs } from "./links";

const p = { origin: "LYS", destination: "BCN", out: "2026-11-14", ret: "2026-11-16", adults: 2 };

describe("liens pré-remplis", () => {
  it("Aviasales : codes et dates collés, euros, marker optionnel", () => {
    expect(LINKS.aviasales(p)).toBe("https://www.aviasales.com/search/LYS1411BCN16112?currency=eur");
    expect(LINKS.aviasales({ ...p, marker: "123" })).toBe("https://www.aviasales.com/search/LYS1411BCN16112?currency=eur&marker=123");
  });
  it("Google Flights : paramètre tfs (protobuf en base64) vérifié dans le navigateur", () => {
    // Lyon → Barcelone du 13 au 15 novembre 2026, 2 adultes : ouvre bien les résultats aller-retour.
    expect(googleFlightsTfs({ ...p, out: "2026-11-13", ret: "2026-11-15" })).toBe("GhoSCjIwMjYtMTEtMTNqBRIDTFlTcgUSA0JDThoaEgoyMDI2LTExLTE1agUSA0JDTnIFEgNMWVNCAgEBSAGYAQE=");
    expect(LINKS.googleFlights(p)).toBe(`https://www.google.com/travel/flights?tfs=${encodeURIComponent(googleFlightsTfs(p))}&hl=fr&gl=fr&curr=EUR`);
    // Un voyageur de plus : un octet de plus dans la liste des passagers.
    expect(googleFlightsTfs({ ...p, adults: 3 })).not.toBe(googleFlightsTfs(p));
    expect(googleFlightsTfs({ ...p, adults: 0 })).toBe(googleFlightsTfs({ ...p, adults: 1 }));
  });
  it("Skyscanner : chemin en minuscules, dates AAMMJJ", () => {
    expect(LINKS.skyscanner(p)).toBe(
      "https://www.skyscanner.fr/transport/vols/lys/bcn/261114/261116/?adults=2&adultsv2=2&cabinclass=economy&rtn=1&preferdirects=false",
    );
  });
  it("Kayak", () => {
    expect(LINKS.kayak(p)).toBe("https://www.kayak.fr/flights/LYS-BCN/2026-11-14/2026-11-16/2adults?sort=bestflight_a");
  });
  it("SNCF Connect, Trainline, BlaBlaCar, Rome2Rio", () => {
    expect(LINKS.sncfConnect("Lyon", "Barcelone", "2026-11-14")).toBe("https://www.sncf-connect.com/app/home/search?userInput=Lyon%20Barcelone%2014%2F11");
    expect(LINKS.trainline("Genève", "Saint-Étienne", "2026-11-14", "2026-11-16")).toBe("https://www.trainline.fr/search/geneve/saint-etienne/2026-11-14/2026-11-16");
    expect(LINKS.blablacar("Lyon", "Barcelone", "2026-11-14", 2)).toBe("https://www.blablacar.fr/search?fn=Lyon&tn=Barcelone&db=2026-11-14&seats=2&search_origin=HOME");
    expect(LINKS.rome2rio("Geneva", "Barcelona")).toBe("https://www.rome2rio.com/fr/s/Geneva/Barcelona");
  });
  it("FlixBus : identifiants de villes, dates JJ.MM.AAAA, aller-retour", () => {
    expect(LINKS.flixbus("Lyon", "Barcelona", "2026-11-14", "2026-11-16", 2)).toBe(
      "https://shop.flixbus.fr/search?departureCity=40df89c1-8646-11e6-9066-549f350fcb0c&arrivalCity=40e086ed-8646-11e6-9066-549f350fcb0c&rideDate=14.11.2026&backRideDate=16.11.2026&adult=2&_locale=fr",
    );
    // Ville hors réseau : son champ reste vide, le reste est pré-rempli.
    expect(LINKS.flixbus("Lyon", "Marrakesh", "2026-11-14", "2026-11-16", 2)).toBe(
      "https://shop.flixbus.fr/search?departureCity=40df89c1-8646-11e6-9066-549f350fcb0c&rideDate=14.11.2026&backRideDate=16.11.2026&adult=2&_locale=fr",
    );
    // Les homonymes ne se mélangent pas : Valence (Drôme) et Valencia (Espagne).
    expect(LINKS.flixbus("Valence", "Valencia", "2026-11-14", "2026-11-16", 1)).toMatch(/departureCity=40e075fa-[0-9a-f-]+&arrivalCity=fe6bf6e1-/);
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

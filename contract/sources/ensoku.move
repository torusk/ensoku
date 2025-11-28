module ensoku::ensoku {
    use std::string::{Self, String};
    use sui::package;
    use sui::display;
    use sui::event;

    /// One-Time-Witness for the module
    public struct ENSOKU has drop {}

    /// The "Snack" (O-yatsu) NFT
    public struct Snack has key, store {
        id: UID,
        name: String,
        description: String,
        image_url: String, // Data URL containing the SVG
        location: String,
        flavor: String,
    }

    /// Event emitted when a snack is minted
    public struct SnackMinted has copy, drop {
        id: ID,
        owner: address,
        flavor: String,
    }

    fun init(otw: ENSOKU, ctx: &mut TxContext) {
        let publisher = package::claim(otw, ctx);

        // Setup Display for Snack
        let mut keys = vector::empty<String>();
        keys.push_back(string::utf8(b"name"));
        keys.push_back(string::utf8(b"description"));
        keys.push_back(string::utf8(b"image_url"));

        let mut values = vector::empty<String>();
        values.push_back(string::utf8(b"{name}"));
        values.push_back(string::utf8(b"{description}"));
        values.push_back(string::utf8(b"{image_url}"));

        let mut display = display::new_with_fields<Snack>(
            &publisher, keys, values, ctx
        );

        // Commit the display
        display::update_version(&mut display);
        
        // Share the publisher and display objects
        sui::transfer::public_share_object(display);
        sui::transfer::public_transfer(publisher, ctx.sender());
    }

    /// Mint a new Snack (O-yatsu)
    /// Generates a fully on-chain SVG based on the flavor and location.
    public fun mint_snack(
        location: String, 
        flavor: String, 
        color: String, // e.g., "#FF5733"
        ctx: &mut TxContext
    ) {
        let id = object::new(ctx);
        
        // Generate simple SVG string
        // Note: In a real app, we might construct this more dynamically.
        // Using data:image/svg+xml;utf8,... format
        let mut svg = string::utf8(b"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='");
        string::append(&mut svg, color);
        string::append(&mut svg, string::utf8(b"'/><text x='50' y='55' font-size='10' text-anchor='middle' fill='white'>"));
        string::append(&mut svg, flavor);
        string::append(&mut svg, string::utf8(b"</text></svg>"));

        let mut snack = Snack {
            id,
            name: flavor,
            description: string::utf8(b"A delicious snack found at "),
            image_url: svg,
            location,
            flavor,
        };
        
        // Append location to description
        let desc_mut = &mut snack.description;
        string::append(desc_mut, location);

        event::emit(SnackMinted {
            id: object::id(&snack),
            owner: ctx.sender(),
            flavor: snack.flavor,
        });

        sui::transfer::public_transfer(snack, ctx.sender());
    }
}

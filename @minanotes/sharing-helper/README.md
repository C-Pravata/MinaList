# @minanotes/sharing-helper

Helps retrieve items shared from the iOS Share Extension.

## Install

```bash
npm install @minanotes/sharing-helper
npx cap sync
```

## API

<docgen-index>

* [`checkForSharedItem()`](#checkforshareditem)
* [Interfaces](#interfaces)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### checkForSharedItem()

```typescript
checkForSharedItem() => Promise<SharedItem>
```

Checks for an item shared via the iOS Share Extension.
Returns the shared item if found, or an empty object if nothing is pending.
The item is cleared from the share queue after being retrieved.

**Returns:** <code>Promise&lt;<a href="#shareditem">SharedItem</a>&gt;</code>

--------------------


### Interfaces


#### SharedItem

| Prop                    | Type                |
| ----------------------- | ------------------- |
| **`type`**              | <code>string</code> |
| **`value`**             | <code>string</code> |
| **`text`**              | <code>string</code> |
| **`base64Data`**        | <code>string</code> |
| **`filename`**          | <code>string</code> |
| **`errorLoadingImage`** | <code>string</code> |

</docgen-api>

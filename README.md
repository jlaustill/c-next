# Learn c-next in Y Minutes

## Introduction
c-next is a low-level, memory-safe programming language designed to be simple, foolproof, and transpile directly to C. It enforces strict type safety, eliminates implicit type coercion, and provides automatic memory management while maintaining high performance. The goal is to make systems programming easier and safer without sacrificing efficiency.

## Syntax Basics

### Variables & Assignment
- `c-next` uses `<-` for assignment to avoid confusion between `=`, `==` and `===`.
- All variables must have explicit types.
- Strings use back ticks \`This is a string\`

```c-next
uint16 speed <- 60;
string message <- `Hello, world!`;
uint8[] nums <- [1,2,3,4];
```

### Type System
- Types follow a strict `(u)(type)(bits)` format.
- No implicit type coercion; all casts must be explicit.
- string is a first class citizen influenced by Arduino

```c-next
uint16 speedMph <- 60;
float32 speedKph <- (float32)speedMph * 1.609;
```

The basic types are meant to be simplified, this is how they would map to c++ types

| c-next | C++                |
| ------ | ------------------ |
| int8   | char               |
| int16  | short int          |
| int32  | int                |
| int64  | long int           |
| uint8  | unsigned char      |
| uint16 | unsigned short int |
| uint32 | unsigned int       |
| uint64 | unsigned long int  |
|        |                    |
| float32| float              |
| float64| double             |
| float96| long double        |
|        |                    |
| string | Arduino String     |
| boolean| boolean            |

### Control Flow
```c-next
if (speed > 50) {
  Serial.println(`Slow down!`);
} else {
  Serial.println(`You're good.`);
}

for (uint8 i <- 0; i < 10; i++) {
  Serial.println(`Count: ${i}`);
}
```

### Functions & Methods
- Functions are **pure** (no side effects), and all parameters are passed **by value**.

```c-next
uint16 Add(uint16 a, uint16 b) {
  return a + b;
}
```

## Memory Management
### Stack vs Heap Allocation
- Stack variables are automatically managed.
- Heap allocation requires an **interface**, and memory is managed automatically by the transpiler.

```c-next
heap(IPerson) Bob;
Bob.firstName <- `Bob`;
Bob.age <- 54;
```

or with initialization:

```c-next
heap(IPerson) Bob <- { firstName: `Bob`, lastName: `Smith`, age: 54 };
```

## Objects & Interfaces

All objects must be defined in their own file, and only one object may be defined per file, anything else will generate a compile error. The object defined MUST match the filename, or a compile error will be generated. Files end with a .cn suffix. The main object types in c-next are interfaces and classes. no variables can be defined outside of a class. There is also no inheritance.

### Defining classes
Classes are meant to be clean, simple, and organized. All class members are private by default and must be explicitly marked as public. Class members must start with a lowercase letter, and method parameters must start with a capital letter. The constructor is the method named the same as the class, and class names must start with a capital letter. This will make the constructors stand out as the only methods with capital letters.
```c-next
class Greeter {
    uint8 age; // private by default
    public string name; // using the public keyword to make something public 

    public Greeter(string Name) { // Method parameters must start with a capital letter
        name <- Name;
    }

    public Greeter(string Name, uint8 Age) { // Function overrides must have a unique signature, and call contructors return a new instance of the class so there is no need to annotate it
        age <- Age;
        name <- Name;
    }

    string getGreeting() {
        return `Hello, ${name}!`; // all class members are in scope for lower scopes
    }
}
```

### Defining Interfaces
Interfaces start with a capital I, and have their own files
```c-next
// IAddress.cn
interface IAddress {
    string street1;
    string street2;
    string city;
    string county;
    string state;
    uint8 zipcode;
    uint8 zip4;
}
```
```c-next
// IPerson.cn
interface IPerson {
  string firstName;
  string lastName;
  uint8 age;
}
```

### Using Interfaces
```c-next
IPerson Alice <- { firstName: `Alice`, lastName: `Johnson`, age: 28 };
Serial.println(`Name: ${Alice.firstName} ${Alice.lastName}, Age: ${Alice.age}`);
```

## Special Features
### String Interpolation
```c-next
string greet() {
  return `Hello, ${message}!`;
}
```

### Concatenation
```c-next
string fullMessage <- `Welcome, ` +<- name +<- `!`;
```

### Importing Modules
Modules written in the `c-next` language can be imported using the `import` directive. Only files with the `.cn` extension are allowed.

```c-next
import `MyModule.cn`; // Valid
```

#### Rules:
- File names must have the `.cn` extension.

## Example Program
```c-next
// IVehicle.cn
interface IVehicle {
  string model;
  uint16 spee;
}
```


```c-next
// main.cnm
#include <Arduino.h>
import "IVehicle.cn";

// The entry file is the ONLY file where things can be defined globally outside of a class

void setup() {
    Serial.begin(115200);
}

void loop() {
    // This is going to print forever :)
    Serial.println(`The ${myCar.model} is going ${myCar.speed} mph.`);
}
```

## Next Steps
- Fix grammar/implementation inconsistency: Update grammar to use lowercase `string` instead of `String` to match README examples
- Implement missing language features documented in README:
  - String interpolation syntax (`\`Hello, ${name}!\``)
  - Control flow statements (`if/else`, `for` loops)
  - Interface parsing rules in grammar
  - Complete type mapping for all documented types (uint8, uint16, float32, boolean, etc.)
- get blink program working for arduino

---


